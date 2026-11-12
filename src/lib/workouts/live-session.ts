/**
 * Какую открытую тренировку показать после перезагрузки WebView.
 * Новую сессию не создаёт.
 */

export type LiveClockSession = {
  id: string;
  clockStatus?: string | null;
  startedAt?: string | null;
  endedAt?: string | null;
  endedBy?: string | null;
  updatedAt?: string | null;
};

function timeOf(value: string | null | undefined): number {
  if (!value) return 0;
  const t = Date.parse(value);
  return Number.isFinite(t) ? t : 0;
}

export function isFinishedSession(session: LiveClockSession): boolean {
  return session.clockStatus === "finished" || Boolean(session.endedAt);
}

export function isLiveSession(session: LiveClockSession): boolean {
  if (isFinishedSession(session)) return false;
  return session.clockStatus === "running" || session.clockStatus === "paused";
}

/**
 * Сначала тренировка, которую смотрели (если она ещё не завершена),
 * иначе одна самая свежая идущая или на паузе.
 */
export function pickSessionToResume<T extends LiveClockSession>(
  sessions: readonly T[],
  preferId?: string | null,
): T | null {
  if (preferId) {
    const preferred = sessions.find((session) => session.id === preferId && !isFinishedSession(session));
    if (preferred) return preferred;
  }
  const live = sessions.filter(isLiveSession);
  if (live.length === 0) return null;
  return [...live].sort((a, b) => {
    const rank = (session: LiveClockSession) => (session.clockStatus === "running" ? 1 : 0);
    const byStatus = rank(b) - rank(a);
    if (byStatus !== 0) return byStatus;
    const byStart = timeOf(b.startedAt) - timeOf(a.startedAt);
    if (byStart !== 0) return byStart;
    return timeOf(b.updatedAt) - timeOf(a.updatedAt);
  })[0] ?? null;
}

/**
 * Чужое «завершено» принимаем только если это явное действие (endedBy = manual).
 * Автозакрытие и пустая причина экран не гасят.
 */
export function shouldAdoptRemoteFinish(remote: {
  clockStatus?: string | null;
  endedBy?: string | null;
}): boolean {
  return remote.clockStatus === "finished" && remote.endedBy === "manual";
}

const RESUME_KEY = "cv-workout-resume-id";

export function readWorkoutResumeId(storage: Pick<Storage, "getItem"> | null | undefined): string | null {
  if (!storage) return null;
  try {
    const id = storage.getItem(RESUME_KEY);
    return id && id.trim() ? id : null;
  } catch {
    return null;
  }
}

export function writeWorkoutResumeId(
  storage: Pick<Storage, "setItem" | "removeItem"> | null | undefined,
  id: string | null,
): void {
  if (!storage) return;
  try {
    if (!id) storage.removeItem(RESUME_KEY);
    else storage.setItem(RESUME_KEY, id);
  } catch {
    // квота или приватный режим
  }
}

export function browserResumeStorage(): Storage | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}
