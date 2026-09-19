import {
  normalizeGroupKeys,
  sameGroupSet,
  type MuscleGroupKey,
} from "@/lib/workouts/muscle-groups";

export const DEFAULT_PROGRESS_RATE = 0.05;

export type LoadSet = {
  weightKg: number;
  reps: number;
};

export type LoadExercise = {
  muscleGroup?: string | null;
  sets: LoadSet[];
};

/** Volume load for one set: kg × reps. */
export function setLoad(set: LoadSet): number {
  const w = Number(set.weightKg);
  const r = Number(set.reps);
  if (!Number.isFinite(w) || !Number.isFinite(r) || w < 0 || r < 0) {
    return 0;
  }
  return w * r;
}

export function exerciseLoad(exercise: LoadExercise): number {
  return exercise.sets.reduce((sum, s) => sum + setLoad(s), 0);
}

export function sessionTotalLoad(exercises: readonly LoadExercise[]): number {
  return exercises.reduce((sum, ex) => sum + exerciseLoad(ex), 0);
}

/**
 * Attribute exercise load to group(s).
 * - If exercise has its own muscleGroup → that group only.
 * - Else split evenly across sessionGroups (or "other" if empty).
 */
export function loadByMuscleGroup(
  exercises: readonly LoadExercise[],
  sessionGroups: readonly string[],
): Record<string, number> {
  const groups = normalizeGroupKeys(sessionGroups);
  const fallback: MuscleGroupKey[] = groups.length > 0 ? groups : ["other"];
  const out: Record<string, number> = {};

  for (const ex of exercises) {
    const load = exerciseLoad(ex);
    if (load <= 0) continue;

    const own = ex.muscleGroup?.trim();
    if (own) {
      out[own] = (out[own] ?? 0) + load;
      continue;
    }

    const share = load / fallback.length;
    for (const g of fallback) {
      out[g] = (out[g] ?? 0) + share;
    }
  }

  return out;
}

export function roundLoad(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.round(value * 10) / 10;
}

export function targetLoad(previousLoad: number, rate: number = DEFAULT_PROGRESS_RATE): number {
  if (!Number.isFinite(previousLoad) || previousLoad <= 0) {
    return 0;
  }
  const r = Number.isFinite(rate) && rate >= 0 ? rate : DEFAULT_PROGRESS_RATE;
  return roundLoad(previousLoad * (1 + r));
}

export function loadDeltaPct(current: number, previous: number): number | null {
  if (!Number.isFinite(previous) || previous <= 0 || !Number.isFinite(current)) {
    return null;
  }
  return Math.round(((current - previous) / previous) * 1000) / 10;
}

export function parseProgressRate(raw: unknown): number {
  if (raw === undefined || raw === null || raw === "") {
    return DEFAULT_PROGRESS_RATE;
  }
  const n = typeof raw === "number" ? raw : Number(raw);
  if (!Number.isFinite(n)) {
    return DEFAULT_PROGRESS_RATE;
  }
  // Accept 5 as 5% or 0.05 as fraction.
  const rate = n > 1 ? n / 100 : n;
  return Math.min(Math.max(rate, 0), 0.25);
}

export type SessionLikeForProgress = {
  id: string;
  date: string;
  createdAt: Date | string;
  muscleKeys: readonly string[];
  totalLoad: number;
  loadByGroup: Record<string, number>;
};

/**
 * Pick previous session for progress:
 * 1) exact same group set
 * 2) else latest session that includes all requested groups
 */
export function findPreviousSession(
  sessions: readonly SessionLikeForProgress[],
  targetGroups: readonly string[],
  options?: { excludeSessionId?: string },
): SessionLikeForProgress | null {
  const groups = normalizeGroupKeys(targetGroups);
  if (groups.length === 0) return null;

  const candidates = sessions
    .filter((s) => s.id !== options?.excludeSessionId)
    .slice()
    .sort((a, b) => {
      const d = b.date.localeCompare(a.date);
      if (d !== 0) return d;
      const ta = a.createdAt instanceof Date ? a.createdAt.getTime() : new Date(a.createdAt).getTime();
      const tb = b.createdAt instanceof Date ? b.createdAt.getTime() : new Date(b.createdAt).getTime();
      return tb - ta;
    });

  const exact = candidates.find((s) => sameGroupSet(s.muscleKeys, groups));
  if (exact) return exact;

  const partial = candidates.find((s) => {
    const keys = new Set(normalizeGroupKeys(s.muscleKeys));
    return groups.every((g) => keys.has(g));
  });
  return partial ?? null;
}

/** Sum of load for requested groups from a previous session snapshot. */
export function previousLoadForGroups(
  previous: SessionLikeForProgress | null,
  targetGroups: readonly string[],
): number {
  if (!previous) return 0;
  const groups = normalizeGroupKeys(targetGroups);
  if (groups.length === 0) return 0;

  if (sameGroupSet(previous.muscleKeys, groups)) {
    return roundLoad(previous.totalLoad);
  }

  let sum = 0;
  for (const g of groups) {
    sum += previous.loadByGroup[g] ?? 0;
  }
  return roundLoad(sum);
}

export function buildProgressSummary(input: {
  targetGroups: readonly string[];
  currentLoad: number;
  previous: SessionLikeForProgress | null;
  progressRate?: number;
}) {
  const rate = parseProgressRate(input.progressRate ?? DEFAULT_PROGRESS_RATE);
  const previousLoad = previousLoadForGroups(input.previous, input.targetGroups);
  const target = targetLoad(previousLoad, rate);
  return {
    previousSessionId: input.previous?.id ?? null,
    previousDate: input.previous?.date ?? null,
    previousLoad,
    targetLoad: target,
    progressRate: rate,
    currentLoad: roundLoad(input.currentLoad),
    deltaPctVsPrevious: loadDeltaPct(input.currentLoad, previousLoad),
    deltaPctVsTarget:
      target > 0 ? loadDeltaPct(input.currentLoad, target) : null,
  };
}
