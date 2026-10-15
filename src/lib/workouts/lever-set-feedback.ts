/**
 * I1/I2 — compare a logged set (or finished exercise) to the remembered lever goal.
 * Returns hit / close / miss for toasts and summary CTAs.
 */

import type { ProgressionLever } from "@/lib/workouts/progression";
import { formatSuggestedKg } from "@/lib/workouts/suggested-load";
import { countWorkingSets } from "@/lib/workouts/lever-session-apply";

export type LeverGoalLike = {
  lever: ProgressionLever;
  kg: number | null;
  reps: number | null;
  /** Volume lever: +1 working set vs last session. */
  extraSet?: boolean;
};

export type SetLikeForLever = {
  weightKg: number | null;
  reps: number | null;
  setType?: string | null;
  completed?: boolean | null;
};

export type LeverVerdict = "hit" | "close" | "miss";

export type SessionLeverOutcome = "hit" | "miss" | "partial";

function isWorkingSet(set: SetLikeForLever): boolean {
  const t = set.setType ?? "working";
  return t !== "warmup" && t !== "drop";
}

function kgOk(actual: number | null, target: number | null, loose = false): boolean {
  if (target == null || !Number.isFinite(target) || target <= 0) return true;
  if (actual == null || !Number.isFinite(actual)) return false;
  if (loose) return actual + 1e-6 >= target * 0.95 || actual + 1e-6 >= target - 2.5;
  return actual + 1e-6 >= target - 0.25;
}

function repsOk(actual: number | null, target: number | null, slack = 0): boolean {
  if (target == null || !Number.isFinite(target) || target <= 0) return true;
  if (actual == null || !Number.isFinite(actual)) return false;
  return actual + 1e-6 >= target - slack;
}

/**
 * Per completed working set vs lever goal.
 * Warmup/drop / missing goal → null (no toast).
 */
export function compareSetToLeverGoal(
  set: SetLikeForLever,
  goal: LeverGoalLike | null | undefined,
): LeverVerdict | null {
  if (!goal) return null;
  if (!isWorkingSet(set)) return null;
  if (set.completed === false) return null;

  const { lever, kg, reps } = goal;

  if (lever === "weight") {
    if (kg == null || kg <= 0) return null;
    if (kgOk(set.weightKg, kg)) return "hit";
    if (kgOk(set.weightKg, kg, true)) return "close";
    return "miss";
  }

  if (lever === "reps") {
    if (reps == null || reps <= 0) return null;
    const weightReady = kgOk(set.weightKg, kg, true);
    if (weightReady && repsOk(set.reps, reps)) return "hit";
    if (weightReady && repsOk(set.reps, reps, 1)) return "close";
    return "miss";
  }

  // volume — set quality toward +1 working set (kg×reps on working sets)
  if (kg != null && kg > 0 && !kgOk(set.weightKg, kg, true)) {
    return "miss";
  }
  if (reps != null && reps > 0) {
    if (repsOk(set.reps, reps) && kgOk(set.weightKg, kg, true)) return "hit";
    if (repsOk(set.reps, reps, 1) && kgOk(set.weightKg, kg, true)) return "close";
    return "miss";
  }
  // Only +1-set intent without kg/reps — treat completed working set as progress.
  return "hit";
}

/** Short toast copy for live logger (I1). */
export function formatLeverSetToast(
  verdict: LeverVerdict,
  goal: LeverGoalLike,
  exerciseName?: string,
): string {
  const name = exerciseName?.trim() ? `«${exerciseName.trim()}» · ` : "";
  const target =
    goal.kg != null && goal.reps != null && goal.reps > 0
      ? `${formatSuggestedKg(goal.kg)} кг × ${goal.reps}`
      : goal.kg != null
        ? `${formatSuggestedKg(goal.kg)} кг`
        : goal.reps != null
          ? `× ${goal.reps}`
          : goal.lever === "volume"
            ? "+1 подход"
            : "цель";

  if (verdict === "hit") {
    if (goal.lever === "volume") return `${name}Цель по тоннажу: подход в цель`;
    if (goal.lever === "reps") return `${name}Цель взята: ${target}`;
    return `${name}Цель взята: ${target}`;
  }
  if (verdict === "close") {
    return `${name}Близко к цели (${target})`;
  }
  return `${name}Мимо цели (${target})`;
}

/**
 * Whole-exercise outcome for session summary (I2).
 * Volume uses working-set count vs last session (+1).
 */
export function evaluateSessionLeverOutcome(
  sets: readonly SetLikeForLever[],
  goal: LeverGoalLike | null | undefined,
  lastWorkingCount?: number | null,
): SessionLeverOutcome | null {
  if (!goal) return null;
  const working = sets.filter((s) => s.completed !== false && isWorkingSet(s));
  if (working.length === 0) return null;

  if (goal.lever === "volume") {
    const last =
      lastWorkingCount != null && lastWorkingCount > 0
        ? lastWorkingCount
        : Math.max(1, working.length - 1);
    const need = last + 1;
    if (countWorkingSets(working) >= need) return "hit";
    // Quality of best set still counts as partial progress.
    const best = working.reduce<LeverVerdict | null>((acc, s) => {
      const v = compareSetToLeverGoal(s, { ...goal, lever: "reps" });
      if (v === "hit") return "hit";
      if (v === "close" && acc !== "hit") return "close";
      if (acc == null) return v;
      return acc;
    }, null);
    if (best === "hit" || best === "close") return "partial";
    return "miss";
  }

  const verdicts = working
    .map((s) => compareSetToLeverGoal(s, goal))
    .filter((v): v is LeverVerdict => v != null);
  if (verdicts.length === 0) return null;
  if (verdicts.some((v) => v === "hit")) return "hit";
  if (verdicts.every((v) => v === "miss")) return "miss";
  return "partial";
}

/** Resolve a goal snapshot from memory fields + optional live chrome. */
export function leverGoalFromMemory(entry: {
  lever: ProgressionLever;
  targetKg: number | null;
  targetReps: number | null;
} | null): LeverGoalLike | null {
  if (!entry) return null;
  return {
    lever: entry.lever,
    kg: entry.targetKg,
    reps: entry.targetReps,
    extraSet: entry.lever === "volume",
  };
}
