/**
 * G2 — structured live-stage goal: max working kg + lever + concrete target.
 */

import type { ProgressionAdvice, ProgressionLever } from "@/lib/workouts/progression";
import { formatSuggestedKg } from "@/lib/workouts/suggested-load";
import {
  adviceWithPreferredLever,
  goalFromLeverOption,
} from "@/lib/workouts/progression-lever-memory";

export type LiveGoalChrome = {
  basisKg: number | null;
  lever: ProgressionLever | null;
  leverLabel: string | null;
  leverRemembered: boolean;
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
      targetLine: `${formatSuggestedKg(fallbackSuggestedKg)} кг`,
      suggestedKg: fallbackSuggestedKg,
      suggestedReps: null,
      extraSet: false,
    };
  }

  const preferred = adviceWithPreferredLever(advice, exerciseName);
  const goal = goalFromLeverOption(preferred.option);
  const kg = goal.kg ?? preferred.suggestedKg ?? advice.suggestedKg ?? fallbackSuggestedKg;
  const reps = goal.reps ?? preferred.suggestedReps;
  const lever = preferred.primaryLever;
  const leverLabel = preferred.option?.label ?? (lever ? LEVER_LABEL[lever] : null);

  let targetLine: string | null = preferred.option?.line ?? null;
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
    targetLine,
    suggestedKg: kg,
    suggestedReps: reps,
    extraSet: goal.extraSet,
  };
}
