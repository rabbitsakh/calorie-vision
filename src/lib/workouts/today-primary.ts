/**
 * Wave B: pick one clear next action for Gym Today.
 */

export type TodayPrimaryKind =
  | "continue"
  | "open_draft"
  | "start_plan"
  | "repeat"
  | "rest"
  | "blank_start"
  | "finished";

export function resolveTodayPrimary(input: {
  hasActive: boolean;
  draftCount: number;
  finishedCount: number;
  plannedCount: number;
  firstEmpty: boolean;
  /** Idle + no plan + past session worth copying → elevate «повторить». */
  hasRepeat?: boolean;
}): TodayPrimaryKind {
  if (input.hasActive) return "continue";
  if (input.draftCount > 0) return "open_draft";
  if (input.finishedCount > 0 && input.plannedCount === 0) return "finished";
  if (input.plannedCount > 0) return "start_plan";
  if (input.firstEmpty) return "blank_start";
  // Idle, no plan, but last finished exists → repeat is the best next action.
  if (input.hasRepeat) return "repeat";
  // Idle, no plan, nothing to copy → rest day (blank is secondary).
  return "rest";
}
