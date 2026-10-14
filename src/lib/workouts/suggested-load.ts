/**
 * Suggest next working weight from top logged working set + session progress rate.
 * Rounds to 0.5 kg (common plate step).
 */

export type WeightSetLike = {
  weightKg?: number | null;
  reps?: number | null;
  setType?: string | null;
  completed?: boolean | null;
};

function isEligibleWorkingSet(s: WeightSetLike): boolean {
  const w = Number(s.weightKg);
  if (!Number.isFinite(w) || w < 0) return false;
  if (s.completed === false) return false;
  const t = s.setType ?? "working";
  // Drop / warmup must not drive «следующий раз» — drop is intentionally lighter.
  return t !== "warmup" && t !== "drop";
}

/**
 * Top working weight this session (max among working / failure / rest_pause).
 * Excludes warmup and drop. Falls back to any completed non-warmup if needed.
 */
export function pickTopWorkingWeight(
  sets: ReadonlyArray<WeightSetLike>,
): number | null {
  const eligible = sets.filter(isEligibleWorkingSet);
  if (eligible.length > 0) {
    return Math.max(...eligible.map((s) => Number(s.weightKg)));
  }
  const fallback = sets.filter((s) => {
    const w = Number(s.weightKg);
    if (!Number.isFinite(w) || w < 0) return false;
    if (s.completed === false) return false;
    return (s.setType ?? "working") !== "warmup";
  });
  if (fallback.length === 0) return null;
  return Math.max(...fallback.map((s) => Number(s.weightKg)));
}

/** @deprecated Prefer pickTopWorkingWeight — kept as alias for call sites / tests. */
export function pickLastWorkingWeight(
  sets: ReadonlyArray<WeightSetLike>,
): number | null {
  return pickTopWorkingWeight(sets);
}

/** Best set for progression: top kg, then best reps at that kg. */
export function pickTopWorkingSet(
  sets: ReadonlyArray<WeightSetLike>,
): { weightKg: number; reps: number | null } | null {
  const eligible = sets.filter(isEligibleWorkingSet);
  const pool =
    eligible.length > 0
      ? eligible
      : sets.filter((s) => {
          const w = Number(s.weightKg);
          if (!Number.isFinite(w) || w < 0) return false;
          if (s.completed === false) return false;
          return (s.setType ?? "working") !== "warmup";
        });
  if (pool.length === 0) return null;
  let best = pool[0]!;
  for (const s of pool) {
    const w = Number(s.weightKg);
    const bw = Number(best.weightKg);
    if (w > bw) {
      best = s;
      continue;
    }
    if (w === bw) {
      const r = Number(s.reps);
      const br = Number(best.reps);
      if (Number.isFinite(r) && (!Number.isFinite(br) || r > br)) best = s;
    }
  }
  const repsRaw = Number(best.reps);
  return {
    weightKg: Number(best.weightKg),
    reps: Number.isFinite(repsRaw) && repsRaw > 0 ? repsRaw : null,
  };
}

export function suggestNextWeightKg(
  lastWeightKg: number | null | undefined,
  progressRate = 0.05,
): number | null {
  if (lastWeightKg == null || !Number.isFinite(lastWeightKg) || lastWeightKg < 0) {
    return null;
  }
  const rate = Number.isFinite(progressRate) ? Math.max(0, progressRate) : 0.05;
  const raw = lastWeightKg * (1 + rate);
  return Math.round(raw * 2) / 2;
}

export function formatSuggestedKg(kg: number): string {
  return Number.isInteger(kg) ? String(kg) : String(kg);
}
