/**
 * Часы тренировки: старт с первого подхода.
 * Тренировка не завершается сама — ни по простою, ни по сворачиванию.
 * Ручное время (endedBy = manual) не переписывается.
 * endedBy = auto — старые строки, закрытые прежним правилом «30 минут без подходов».
 */

/** Сколько держим случайное автозакрытие, чтобы вернуть тренировку после обновления. */
export const AUTO_CLOSE_UNDO_MS = 24 * 60 * 60 * 1000;

export type AutoClockInput = {
  startedAt: Date | null;
  endedAt: Date | null;
  endedBy: string | null;
  /** Время записанных (выполненных) подходов. */
  setTimes: readonly Date[];
  now?: Date;
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
 * Что записать у ещё открытой тренировки.
 * Только недостающее начало. Окончание сюда не попадает.
 * null — менять нечего.
 */
export function planAutoClock(input: AutoClockInput): AutoClockPatch | null {
  if (input.endedAt) return null;
  if (input.endedBy === "manual") return null;

  const times = sorted(input.setTimes);
  if (!input.startedAt && times[0]) {
    return { startedAt: times[0] };
  }
  return null;
}

/**
 * Случайное автозакрытие за последние сутки снова открываем.
 * Ручное завершение и старые автозакрытия не трогаем.
 */
export function planUndoAutoClose(input: {
  endedAt: Date | null;
  endedBy: string | null;
  now?: Date;
  maxAgeMs?: number;
}): AutoClockPatch | null {
  if (input.endedBy !== "auto" || !input.endedAt) return null;
  if (!Number.isFinite(input.endedAt.getTime())) return null;
  const now = input.now ?? new Date();
  const maxAgeMs = input.maxAgeMs ?? AUTO_CLOSE_UNDO_MS;
  if (now.getTime() - input.endedAt.getTime() > maxAgeMs) return null;
  return { endedAt: null, endedBy: null, pausedAt: null };
}

/**
 * Новый выполненный подход: начать часы, если их не было,
 * и снять старое автозавершение, если человек продолжил ту же тренировку.
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
