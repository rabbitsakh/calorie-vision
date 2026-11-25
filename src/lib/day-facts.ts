/**
 * Одна норма дня и одна вода.
 * Карточка «Сегодня», итог дня, лента и экран тренировки берут расход отсюда:
 * завершённая сессия — по началу и концу, открытая — без простоя после последнего подхода.
 * Сохранённой «нормы на день» в базе нет: она считается заново из профиля, сессий и воды.
 */

import { dateKeyAndTimeToIso } from "@/lib/dates";
import { sessionElapsedSec, type SessionClock } from "@/lib/workouts/session-clock";

/** После последнего подхода ещё считаем отдых. Дальше простой в норму не входит. */
export const OPEN_SESSION_IDLE_GRACE_SEC = 30 * 60;
const MAX_BILLABLE_SEC = 24 * 60 * 60;

export type BillableSet = {
  completed?: boolean | null;
  createdAt?: Date | string | null;
};

export type BillableSession = {
  startedAt?: Date | string | null;
  endedAt?: Date | string | null;
  pausedAt?: Date | string | null;
  pausedMs?: number | null;
  exercises?: readonly { sets?: readonly BillableSet[] | null }[] | null;
};

function asClock(session: BillableSession): SessionClock {
  return {
    startedAt: session.startedAt ?? null,
    endedAt: session.endedAt ?? null,
    pausedAt: session.pausedAt ?? null,
    pausedMs: session.pausedMs ?? null,
  };
}

export function sumWaterMl(entries: readonly { ml?: number | null }[] | null | undefined): number {
  let total = 0;
  for (const entry of entries ?? []) {
    const ml = Number(entry?.ml);
    if (Number.isFinite(ml) && ml > 0) total += ml;
  }
  return Math.round(total);
}

/** Миллилитры, которые показывают герой, итог дня и карточка в ленте. */
export function shownWaterMl(totalMl: number | null | undefined): number {
  const n = Number(totalMl);
  if (!Number.isFinite(n) || n <= 0) return 0;
  return Math.round(n);
}

export function shownWaterTargetMl(targetMl: number | null | undefined): number {
  const n = Number(targetMl);
  if (!Number.isFinite(n) || n <= 0) return 0;
  return Math.round(n);
}

export function setLoggedAtMs(session: BillableSession | null | undefined): number[] {
  const out: number[] = [];
  for (const exercise of session?.exercises ?? []) {
    for (const set of exercise.sets ?? []) {
      if (set.completed === false || set.createdAt == null) continue;
      const t = set.createdAt instanceof Date ? set.createdAt.getTime() : new Date(set.createdAt).getTime();
      if (Number.isFinite(t)) out.push(t);
    }
  }
  return out;
}

/**
 * Секунды, по которым считаем расход.
 * Сессия с концом — ровно интервал часов, не дольше суток.
 * Сессия без конца — живые часы, пока подходы свежие.
 * Если последний подход давно, хвост до «сейчас» не добавляем: это и давало тысячи ккал «за зал».
 */
export function billableElapsedSec(
  clock: BillableSession,
  loggedAtMs: readonly number[] = [],
  nowMs = Date.now(),
): number {
  const normalized = asClock(clock);
  const ended = normalized.endedAt != null && Number.isFinite(new Date(normalized.endedAt).getTime());
  if (ended) {
    return Math.min(MAX_BILLABLE_SEC, sessionElapsedSec(normalized, nowMs));
  }
  const logged = loggedAtMs.filter((t) => Number.isFinite(t));
  if (logged.length === 0) {
    return Math.min(MAX_BILLABLE_SEC, sessionElapsedSec(normalized, nowMs));
  }
  const last = Math.max(...logged);
  const idleSec = Math.floor((nowMs - last) / 1000);
  if (idleSec <= OPEN_SESSION_IDLE_GRACE_SEC) {
    return Math.min(MAX_BILLABLE_SEC, sessionElapsedSec(normalized, nowMs));
  }
  const billUntil = last + OPEN_SESSION_IDLE_GRACE_SEC * 1000;
  return Math.min(MAX_BILLABLE_SEC, sessionElapsedSec(normalized, billUntil));
}

export function sessionBillableElapsedSec(session: BillableSession, nowMs = Date.now()): number {
  return billableElapsedSec(session, setLoggedAtMs(session), nowMs);
}

/**
 * Начало и конец из полей «время» на дату тренировки.
 * Если конец раньше начала в тот же день, это переход через полночь, а не лишние сутки.
 */
export function wallClockSessionInstants(
  dateKey: string,
  startHHMM: string,
  endHHMM: string,
  timezone?: string | null,
): { startedAt: string; endedAt: string } | null {
  const startIso = dateKeyAndTimeToIso(dateKey, startHHMM, timezone);
  let endIso = dateKeyAndTimeToIso(dateKey, endHHMM, timezone);
  if (!startIso || !endIso) return null;
  if (new Date(endIso).getTime() < new Date(startIso).getTime()) {
    endIso = new Date(new Date(endIso).getTime() + 24 * 60 * 60 * 1000).toISOString();
  }
  const span = new Date(endIso).getTime() - new Date(startIso).getTime();
  if (span > MAX_BILLABLE_SEC * 1000) return null;
  return { startedAt: startIso, endedAt: endIso };
}
