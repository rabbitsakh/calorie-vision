/**
 * G2 — structured live-stage goal: max working kg + lever + concrete target.
 */

import type { ProgressionAdvice, ProgressionLever } from "@/lib/workouts/progression";
import { formatSuggestedKg } from "@/lib/workouts/suggested-load";
import {
  adviceWithPreferredLever,
  goalFromLeverOption,
} from "@/lib/workouts/progression-lever-memory";
import {
  formatLeverStreakHint,
  getLeverHitStreak,
} from "@/lib/workouts/lever-outcome-history";
import {
  formatLeverRecoveryHint,
  resolveLeverSessionGoal,
} from "@/lib/workouts/lever-session-apply";

export type LiveGoalChrome = {
  basisKg: number | null;
  lever: ProgressionLever | null;
  leverLabel: string | null;
  leverRemembered: boolean;
  /** J2 — soft streak under remembered lever, e.g. «3× подряд». */
  streakHint: string | null;
  /** L — soft recovery after 2× miss. */
  recoveryHint: string | null;
  /** Short target for the big line, e.g. «84 кг» or «80 кг × 6». */
  targetLine: string | null;
  suggestedKg: number | null;
  suggestedReps: number | null;
  extraSet: boolean;
};

const LEVER_LABEL: Record<ProgressionLever, string> = {
  weight: "Вес",
  volume: "Тоннаж",
  reps: "Повторы",
};

export function buildLiveGoalChrome(
  advice: ProgressionAdvice | null | undefined,
  exerciseName: string,
  fallbackSuggestedKg: number | null = null,
): LiveGoalChrome | null {
  if (!advice && fallbackSuggestedKg == null) return null;
  if (!advice || (advice.kind === "base" && !advice.options?.length)) {
    if (fallbackSuggestedKg == null) return null;
    return {
      basisKg: null,
      lever: "weight",
      leverLabel: "Вес",
      leverRemembered: false,
      streakHint: null,
      recoveryHint: null,
      targetLine: `${formatSuggestedKg(fallbackSuggestedKg)} кг`,
      suggestedKg: fallbackSuggestedKg,
      suggestedReps: null,
      extraSet: false,
    };
  }

  const preferred = adviceWithPreferredLever(advice, exerciseName);
  const goal = goalFromLeverOption(preferred.option);
  // L: prefer miss-recovery targets over remembered progression when active.
  const recoveryGoal = resolveLeverSessionGoal({
    name: exerciseName,
    kind: "barbell",
    progressRate: 0.05,
    sets: [],
    lastTimeSets:
      advice.basisKg != null
        ? [{ weightKg: advice.basisKg, reps: advice.basisReps ?? null, setType: "working", completed: true }]
        : null,
  });
  const useRecovery = Boolean(recoveryGoal?.recovery);
  const kg = useRecovery
    ? recoveryGoal!.kg
    : goal.kg ?? preferred.suggestedKg ?? advice.suggestedKg ?? fallbackSuggestedKg;
  const reps = useRecovery
    ? recoveryGoal!.reps
    : goal.reps ?? preferred.suggestedReps;
  const lever = useRecovery ? recoveryGoal!.lever : preferred.primaryLever;
  const leverLabel = useRecovery
    ? (lever ? LEVER_LABEL[lever] : null)
    : preferred.option?.label ?? (lever ? LEVER_LABEL[lever] : null);
  const streakHint =
    !useRecovery && preferred.leverRemembered
      ? formatLeverStreakHint(getLeverHitStreak(exerciseName))
      : null;
  const recoveryHint = formatLeverRecoveryHint(recoveryGoal);

  let targetLine: string | null = useRecovery
    ? null
    : preferred.option?.line ?? null;
  if (!targetLine && kg != null) {
    targetLine =
      reps != null && reps > 0
        ? `${formatSuggestedKg(kg)} кг × ${reps}`
        : `${formatSuggestedKg(kg)} кг`;
  }

  return {
    basisKg: advice.basisKg ?? null,
    lever,
    leverLabel,
    leverRemembered: preferred.leverRemembered,
    streakHint,
    recoveryHint,
    targetLine,
    suggestedKg: kg,
    suggestedReps: reps,
    extraSet: useRecovery ? Boolean(recoveryGoal?.extraSet) : goal.extraSet,
  };
}
