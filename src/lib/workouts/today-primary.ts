/**
 * Gym Today: what to do first.
 *
 * An in-progress session still wins. Otherwise the primary action is always a
 * free (off-plan) workout — including on a planned day and when a past session
 * could be copied. «По плану» and «Повторить прошлую» are secondary buttons.
 */

export type TodayPrimaryKind = "continue" | "open_draft" | "blank_start" | "finished";

export const GYM_START_LABELS = {
  free: "Начать тренировку",
  another: "Начать ещё одну",
  plan: "По плану",
  repeat: "Повторить прошлую",
} as const;

/** Big CTA copy. Finished today still starts an empty free workout. */
export function gymBigStartLabel(finishedToday: boolean): string {
  return finishedToday ? GYM_START_LABELS.another : GYM_START_LABELS.free;
}

/** Big CTA always opens an empty free workout — never repeat. */
export type GymBigStartAction = "blank";

export type GymStartChrome = {
  /** Idle day, including days that already have a plan. */
  showBigStart: boolean;
  bigStart: GymBigStartAction;
  /** Secondary: start today's plan template. Only when a plan exists. */
  showPlan: boolean;
  /** Secondary: repeat the previous finished session. Only when one exists. */
  showRepeat: boolean;
};

export function resolveTodayPrimary(input: {
  hasActive: boolean;
  draftCount: number;
  finishedCount: number;
  /** Kept for callers. A plan does not replace the free-workout primary. */
  plannedCount: number;
  /** Kept for callers. First-run still starts a free workout. */
  firstEmpty: boolean;
  /** Kept for callers. A past session does not replace the free-workout primary. */
  hasRepeat?: boolean;
}): TodayPrimaryKind {
  if (input.hasActive) return "continue";
  if (input.draftCount > 0) return "open_draft";
  if (input.finishedCount > 0) return "finished";
  return "blank_start";
}

/**
 * Which start buttons the gym day shows.
 * The big button is always a free workout and is shown on every idle day,
 * including planned days. Plan and repeat are separate secondaries.
 */
export function resolveGymStartChrome(input: {
  hasActive: boolean;
  draftCount: number;
  plannedCount: number;
  hasRepeat: boolean;
}): GymStartChrome {
  const idle = !input.hasActive && input.draftCount === 0;
  return {
    showBigStart: idle,
    bigStart: "blank",
    showPlan: idle && input.plannedCount > 0,
    showRepeat: idle && input.hasRepeat,
  };
}
