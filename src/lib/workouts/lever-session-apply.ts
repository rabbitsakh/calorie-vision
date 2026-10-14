/**
 * H1/H2 — apply remembered progression lever when opening / repeating a session:
 * prefill draft kg×reps, and for volume add one extra working set.
 */

import {
  adviseProgression,
  type ProgressionLever,
  type ProgressionPoint,
} from "@/lib/workouts/progression";
import {
  adviceWithPreferredLever,
  getLeverMemory,
} from "@/lib/workouts/progression-lever-memory";
import { formatSuggestedKg, pickTopWorkingSet } from "@/lib/workouts/suggested-load";

export type LeverSessionGoal = {
  lever: ProgressionLever;
  fromMemory: true;
  kg: number | null;
  reps: number | null;
  extraSet: boolean;
};

type SetLike = {
  weightKg: number | null;
  reps: number | null;
  setType?: string | null;
  completed?: boolean | null;
};

export function countWorkingSets(sets: readonly SetLike[]): number {
  let n = 0;
  for (const s of sets) {
    const t = s.setType ?? "working";
    if (t === "warmup" || t === "drop") continue;
    n += 1;
  }
  return n;
}

export function countIncompleteWorkingSets(sets: readonly SetLike[]): number {
  let n = 0;
  for (const s of sets) {
    if (s.completed !== false) continue;
    const t = s.setType ?? "working";
    if (t === "warmup" || t === "drop") continue;
    n += 1;
  }
  return n;
}

/**
 * Resolve concrete goal from lever memory (+ fresh advice options when possible).
 * Returns null when no memory / cardio / no usable target.
 */
export function resolveLeverSessionGoal(input: {
  name: string;
  kind: string;
  progressRate: number;
  sets: readonly SetLike[];
  lastTimeSets?: readonly SetLike[] | null;
  historyPoints?: readonly ProgressionPoint[] | null;
}): LeverSessionGoal | null {
  if (input.kind === "cardio") return null;
  const mem = getLeverMemory(input.name);
  if (!mem) return null;

  const top =
    pickTopWorkingSet(input.sets) ??
    pickTopWorkingSet(
      (input.lastTimeSets ?? []).map((s) => ({
        weightKg: s.weightKg,
        reps: s.reps,
        setType: (s.setType ?? "working") as "working",
        completed: true,
      })),
    );

  const basisKg = top?.weightKg ?? mem.basisKg;
  const basisReps = top?.reps ?? mem.targetReps;
  const points = input.historyPoints ?? [];

  if (basisKg != null && basisKg > 0) {
    const advice = adviseProgression(
      points,
      input.progressRate,
      basisKg,
      basisReps,
    );
    const preferred = adviceWithPreferredLever(advice, input.name);
    return {
      lever: mem.lever,
      fromMemory: true,
      kg: preferred.suggestedKg ?? mem.targetKg,
      reps: preferred.suggestedReps ?? mem.targetReps,
      extraSet: mem.lever === "volume",
    };
  }

  if (mem.targetKg == null && mem.targetReps == null && mem.lever !== "volume") {
    return null;
  }
  return {
    lever: mem.lever,
    fromMemory: true,
    kg: mem.targetKg,
    reps: mem.targetReps,
    extraSet: mem.lever === "volume",
  };
}

/**
 * Volume (+1 set) when we already have working sets and none spare beyond last time.
 * Empty exercises → draft-only (no auto-create of a full ladder).
 */
export function needsVolumeExtraSet(
  sets: readonly SetLike[],
  lastWorkingCount: number | null | undefined,
  goal: LeverSessionGoal | null,
): boolean {
  if (!goal?.extraSet) return false;
  const working = countWorkingSets(sets);
  if (working === 0) return false;
  const last =
    lastWorkingCount != null && lastWorkingCount > 0 ? lastWorkingCount : working;
  // Already have a spare incomplete beyond last session's count.
  if (working > last && countIncompleteWorkingSets(sets) > 0) return false;
  return working <= last;
}

/** Overlay lever kg/reps onto an existing draft (strings). */
export function mergeDraftWithLeverGoal(
  draft: { kg: string; reps: string },
  goal: LeverSessionGoal | null,
): { kg: string; reps: string } {
  if (!goal) return draft;
  return {
    kg:
      goal.kg != null && Number.isFinite(goal.kg)
        ? formatSuggestedKg(goal.kg)
        : draft.kg,
    reps:
      goal.reps != null && goal.reps > 0 ? String(goal.reps) : draft.reps,
  };
}

/** Body for POST incomplete working set (volume +1). */
export function volumeExtraSetBody(goal: LeverSessionGoal): {
  weightKg: number;
  reps: number;
  setType: "working";
  completed: false;
} | null {
  if (!goal.extraSet) return null;
  if (goal.kg == null || !Number.isFinite(goal.kg) || goal.kg < 0) return null;
  if (goal.reps == null || !Number.isFinite(goal.reps) || goal.reps <= 0) return null;
  return {
    weightKg: goal.kg,
    reps: Math.floor(goal.reps),
    setType: "working",
    completed: false,
  };
}
