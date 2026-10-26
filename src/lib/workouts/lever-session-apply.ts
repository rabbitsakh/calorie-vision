/**
 * H1/H2 — apply remembered progression lever when opening / repeating a session:
 * prefill draft kg×reps, and for volume add one extra working set.
 * L — after 2× miss, soft deload (weight) or switch lever (volume↔reps) on open.
 */

import {
  adviseProgression,
  suggestDeloadKg,
  type ProgressionLever,
  type ProgressionPoint,
} from "@/lib/workouts/progression";
import {
  adviceWithPreferredLever,
  getLeverMemory,
  setLeverMemory,
  type LeverMemoryEntry,
  type LeverRecoveryKind,
} from "@/lib/workouts/progression-lever-memory";
import { getLeverMissStreak } from "@/lib/workouts/lever-outcome-history";
import { formatSuggestedKg, pickTopWorkingSet } from "@/lib/workouts/suggested-load";

export type { LeverRecoveryKind };

export type LeverSessionGoal = {
  lever: ProgressionLever;
  fromMemory: true;
  kg: number | null;
  reps: number | null;
  extraSet: boolean;
  /** L: recovery after 2× miss on the remembered lever. */
  recovery?: LeverRecoveryKind;
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

/**
 * Mutating lever apply (PATCH planned / POST volume +1) only on fresh create/start/repeat.
 * Resume / list reopen must pass false — otherwise goal sets get re-appended.
 */
export function shouldMutateLeverOnOpen(opts?: {
  applyLever?: boolean;
}): boolean {
  return Boolean(opts?.applyLever);
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

/** Soft chrome line when L recovery is active. */
export function formatLeverRecoveryHint(
  goal: LeverSessionGoal | null | undefined,
): string | null {
  if (!goal?.recovery) return null;
  if (goal.recovery === "deload") return "Soft deload после 2× мимо";
  return "Рычаг сменён после 2× мимо";
}

/** O: Today strip line for an armed recovery memory entry. */
export function formatArmedRecoveryChromeLine(
  entry: Pick<LeverMemoryEntry, "name" | "recovery">,
): string | null {
  if (!entry.recovery) return null;
  if (entry.recovery === "deload") {
    return `${entry.name} · soft deload`;
  }
  return `${entry.name} · новый рычаг`;
}

/**
 * L — concrete recovery goal after 2× miss (pure; persist via {@link persistLeverRecoveryMemory}).
 */
export function buildMissRecoveryGoal(input: {
  name: string;
  mem: LeverMemoryEntry;
  basisKg: number;
  basisReps: number | null;
}): LeverSessionGoal | null {
  if (getLeverMissStreak(input.name) < 2) return null;
  const reps =
    input.basisReps != null && input.basisReps > 0
      ? input.basisReps
      : input.mem.targetReps;

  // N: already deloaded once and still missing → switch lever, don't stack deload.
  if (input.mem.recovery === "deload" || input.mem.recovery === "switch") {
    if (input.mem.lever === "weight" || input.mem.lever === "volume") {
      return {
        lever: "reps",
        fromMemory: true,
        kg: input.basisKg,
        reps,
        extraSet: false,
        recovery: "switch",
      };
    }
    return {
      lever: "volume",
      fromMemory: true,
      kg: input.basisKg,
      reps,
      extraSet: true,
      recovery: "switch",
    };
  }

  if (input.mem.lever === "weight") {
    const kg = suggestDeloadKg(input.basisKg);
    return {
      lever: "weight",
      fromMemory: true,
      kg,
      reps,
      extraSet: false,
      recovery: "deload",
    };
  }

  // volume ↔ reps switch (avoid repeating the failing lever).
  if (input.mem.lever === "volume") {
    return {
      lever: "reps",
      fromMemory: true,
      kg: input.basisKg,
      reps,
      extraSet: false,
      recovery: "switch",
    };
  }

  // reps (or unknown) → volume +1 set at same load
  return {
    lever: "volume",
    fromMemory: true,
    kg: input.basisKg,
    reps,
    extraSet: true,
    recovery: "switch",
  };
}

/** Persist recovered lever so the next open keeps the soft path until a hit. */
export function persistLeverRecoveryMemory(
  name: string,
  goal: LeverSessionGoal,
  basisKg: number | null,
): void {
  if (!goal.recovery) return;
  setLeverMemory({
    name,
    lever: goal.lever,
    basisKg,
    targetKg: goal.kg,
    targetReps: goal.reps,
    recovery: goal.recovery,
  });
}

/**
 * Finish summary — after recording a miss, arm soft-deload / switch so Today strip
 * and next open see recovery without waiting for applyLeverGoalsOnOpen.
 */
export function armMissRecoveryAfterFinish(input: {
  name: string;
  lever: ProgressionLever;
  basisKg: number | null;
  basisReps?: number | null;
  at?: string;
}): LeverSessionGoal | null {
  let mem = getLeverMemory(input.name);
  if (!mem) {
    setLeverMemory({
      name: input.name,
      lever: input.lever,
      basisKg: input.basisKg,
      targetKg: input.basisKg,
      targetReps: input.basisReps ?? null,
      at: input.at,
    });
    mem = getLeverMemory(input.name);
  }
  if (!mem) return null;
  // Keep memory lever aligned with the miss thread for streak matching.
  if (mem.lever !== input.lever && !mem.recovery) {
    setLeverMemory({
      name: input.name,
      lever: input.lever,
      basisKg: input.basisKg ?? mem.basisKg,
      targetKg: mem.targetKg,
      targetReps: input.basisReps ?? mem.targetReps,
      at: input.at ?? mem.at,
    });
    mem = getLeverMemory(input.name);
    if (!mem) return null;
  }
  const basisKg = input.basisKg ?? mem.basisKg ?? 0;
  if (!(basisKg > 0)) return null;
  const goal = buildMissRecoveryGoal({
    name: input.name,
    mem,
    basisKg,
    basisReps: input.basisReps ?? mem.targetReps,
  });
  if (!goal) return null;
  persistLeverRecoveryMemory(input.name, goal, basisKg);
  return goal;
}

/** N: summary chrome for recovery outcome this session. */
export function formatRecoveryOutcomeLine(
  recovery: LeverRecoveryKind | null | undefined,
  outcome: "hit" | "miss" | "partial" | null | undefined,
): string | null {
  if (!recovery || !outcome) return null;
  if (outcome === "hit") return "Восстановление сработало — цель взята";
  if (outcome === "miss") {
    return recovery === "deload"
      ? "После soft deload всё ещё мимо — смените рычаг"
      : "Новый рычаг не взят — попробуйте другой";
  }
  return null;
}

/**
 * Resolve concrete goal from lever memory (+ fresh advice options when possible).
 * Returns null when no memory / cardio / no usable target.
 * L: 2× miss → deload or switch before normal remembered path.
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
    const recovery = buildMissRecoveryGoal({
      name: input.name,
      mem,
      basisKg,
      basisReps,
    });
    if (recovery) return recovery;

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
  // Mid-workout reopen: user already logged a working set — do not auto-append.
  if (hasLoggedWorkingSet(sets)) return false;
  const working = countWorkingSets(sets);
  if (working === 0) return false;
  const last =
    lastWorkingCount != null && lastWorkingCount > 0 ? lastWorkingCount : working;
  // Already have a spare incomplete beyond last session's count.
  if (working > last && countIncompleteWorkingSets(sets) > 0) return false;
  return working <= last;
}

/** True when at least one non-warmup/drop set is completed (user is mid-exercise). */
export function hasLoggedWorkingSet(sets: readonly SetLike[]): boolean {
  for (const s of sets) {
    if (s.completed === false) continue;
    const t = s.setType ?? "working";
    if (t === "warmup" || t === "drop") continue;
    return true;
  }
  return false;
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
