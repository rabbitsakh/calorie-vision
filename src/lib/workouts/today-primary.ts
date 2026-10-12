/**
 * Wave B: pick one clear next action for Gym Today.
 */

export type TodayPrimaryKind =
  | "continue"
  | "open_draft"
  | "start_plan"
  | "rest"
  | "blank_start"
  | "finished";

export function resolveTodayPrimary(input: {
  hasActive: boolean;
  draftCount: number;
  finishedCount: number;
  plannedCount: number;
  firstEmpty: boolean;
}): TodayPrimaryKind {
  if (input.hasActive) return "continue";
  if (input.draftCount > 0) return "open_draft";
  if (input.finishedCount > 0 && input.plannedCount === 0) return "finished";
  if (input.plannedCount > 0) return "start_plan";
  if (input.firstEmpty) return "blank_start";
  // Idle, no plan → rest day (blank is secondary).
  return "rest";
}
