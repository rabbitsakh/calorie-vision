/**
 * Часы тренировки: старт с первого подхода, автозавершение после 30 минут без подходов.
 * Ручное время (endedBy = manual) не переписывается.
 */

export const IDLE_CLOSE_MS = 30 * 60 * 1000;

export type AutoClockInput = {
  startedAt: Date | null;
  endedAt: Date | null;
  endedBy: string | null;
  /** Время записанных (выполненных) подходов. */
  setTimes: readonly Date[];
  now?: Date;
  idleMs?: number;
};

export type AutoClockPatch = {
  startedAt?: Date;
  endedAt?: Date | null;
  endedBy?: string | null;
  pausedAt?: null;
};

function sorted(times: readonly Date[]): Date[] {
  return [...times]
    .filter((d) => d instanceof Date && Number.isFinite(d.getTime()))
    .sort((a, b) => a.getTime() - b.getTime());
}

/**
 * Что записать, если тренировка ещё открыта и давно нет подходов.
 * null — менять нечего.
 */
export function planAutoClock(input: AutoClockInput): AutoClockPatch | null {
  if (input.endedAt) return null;
  if (input.endedBy === "manual") return null;

  const now = input.now ?? new Date();
  const idleMs = input.idleMs ?? IDLE_CLOSE_MS;
  const times = sorted(input.setTimes);
  const patch: AutoClockPatch = {};
  const startedAt = input.startedAt ?? (times[0] ?? null);
  if (!input.startedAt && times[0]) {
    patch.startedAt = times[0];
  }

  const last = times[times.length - 1] ?? null;
  if (last && now.getTime() - last.getTime() >= idleMs) {
    patch.endedAt = last;
    patch.endedBy = "auto";
    patch.pausedAt = null;
    if (!input.startedAt) patch.startedAt = times[0];
    return patch;
  }

  if (!last && startedAt && now.getTime() - startedAt.getTime() >= idleMs) {
    patch.endedAt = startedAt;
    patch.endedBy = "auto";
    patch.pausedAt = null;
    return patch;
  }

  if (patch.startedAt) return patch;
  return null;
}

/**
 * Новый выполненный подход: начать часы, если их не было,
 * и снять автозавершение, если человек продолжил ту же тренировку.
 */
export function planClockOnLoggedSet(
  input: {
    startedAt: Date | null;
    endedAt: Date | null;
    endedBy: string | null;
  },
  at: Date,
): AutoClockPatch | null {
  const patch: AutoClockPatch = {};
  if (input.endedBy === "auto") {
    patch.endedAt = null;
    patch.endedBy = null;
    patch.pausedAt = null;
  } else if (input.endedAt) {
    return null;
  }
  if (!input.startedAt) {
    patch.startedAt = at;
  }
  return Object.keys(patch).length > 0 ? patch : null;
}
