/**
 * Suggest next working weight from last logged set + session progress rate.
 * Rounds to 0.5 kg (common plate step).
 */
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

/** Prefer last working (non-warmup) set; fall back to last set with weight. */
export function pickLastWorkingWeight(
  sets: ReadonlyArray<{ weightKg?: number | null; setType?: string | null; completed?: boolean | null }>,
): number | null {
  const withWeight = sets.filter(
    (s) => s.weightKg != null && Number.isFinite(Number(s.weightKg)) && Number(s.weightKg) >= 0,
  );
  if (withWeight.length === 0) return null;
  const working = [...withWeight]
    .reverse()
    .find((s) => (s.setType ?? "working") !== "warmup" && s.completed !== false);
  const pick = working ?? withWeight[withWeight.length - 1]!;
  return Number(pick.weightKg);
}

export function formatSuggestedKg(kg: number): string {
  return Number.isInteger(kg) ? String(kg) : String(kg);
}
