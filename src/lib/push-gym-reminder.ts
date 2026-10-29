/**
 * Gym push logic — skip when the user is already training or done today.
 * Copy pools rotate by user + date for variety without shame framing.
 */

export type GymReminderWorkoutState = {
  /** Clock started, not finished (running or paused). */
  hasActiveWorkoutToday?: boolean | null;
  /** Session finished today. */
  hasFinishedWorkoutToday?: boolean | null;
  /** At least one completed set logged today (even if clock idle). */
  hasLoggedWorkoutSetToday?: boolean | null;
};

/** True → do not send «иди в зал» (already there / already trained). */
export function shouldSkipGymReminder(state: GymReminderWorkoutState): boolean {
  if (state.hasActiveWorkoutToday) return true;
  if (state.hasFinishedWorkoutToday) return true;
  if (state.hasLoggedWorkoutSetToday) return true;
  return false;
}

/** Live session window: older open clocks are treated as forgotten, not «in the gym». */
export const GYM_QUIET_WINDOW_MS = 3 * 60 * 60_000;

/** True while a session clock is open and started recently — mute all nudges. */
export function isInGymQuietWindow(
  sessions: ReadonlyArray<{ startedAt: Date | string | null; endedAt: Date | string | null }>,
  now: Date = new Date(),
): boolean {
  const nowMs = now.getTime();
  return sessions.some((s) => {
    if (s.startedAt == null || s.endedAt != null) return false;
    const started = new Date(s.startedAt).getTime();
    return Number.isFinite(started) && nowMs - started >= 0 && nowMs - started < GYM_QUIET_WINDOW_MS;
  });
}

export type GymReminderCopy = { title: string; body: string };

/** Motivating, practical variants — no «продолжить» when there is nothing open. */
export const GYM_REMINDER_COPY_POOL: readonly GymReminderCopy[] = [
  {
    title: "День силы?",
    body: "Короткая сессия лучше идеальной, которой не было. Открой Зал.",
  },
  {
    title: "Тело ждёт нагрузку",
    body: "Один блок по плану — и день уже в ритме. Зал → старт.",
  },
  {
    title: "Пора в зал",
    body: "План на сегодня готов. Зайди в Зал и начни с первого подхода.",
  },
  {
    title: "Силовая на сегодня",
    body: "Не нужно идеально — нужно начать. Открой Зал, когда готов.",
  },
  {
    title: "Тренировка зовёт",
    body: "Сделай хотя бы разминку и первый рабочий — остальное подтянется.",
  },
  {
    title: "Сегодня двигаемся",
    body: "Зал открыт: старт по шаблону или свой список — как удобнее.",
  },
];

function hashKey(key: string): number {
  let hash = 0;
  for (let i = 0; i < key.length; i += 1) {
    hash = (hash * 31 + key.charCodeAt(i)) >>> 0;
  }
  return hash;
}

/** Stable-within-day index into a copy pool (rotates across days). */
export function pickCopyPoolIndex(
  userId: string,
  kind: string,
  today: string,
  poolSize: number,
): number {
  const n = Math.max(1, Math.floor(poolSize));
  return hashKey(`${userId}:${kind}:${today}`) % n;
}

export function pickGymReminderCopy(input: {
  userId?: string | null;
  today: string;
  slot?: number;
}): GymReminderCopy {
  const size = GYM_REMINDER_COPY_POOL.length;
  const idx =
    input.slot != null && Number.isFinite(input.slot)
      ? ((Math.trunc(input.slot) % size) + size) % size
      : pickCopyPoolIndex(input.userId ?? "anon", "gym", input.today, size);
  return GYM_REMINDER_COPY_POOL[idx]!;
}
