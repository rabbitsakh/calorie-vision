/**
 * Show calories as a confidence-aware range («450–550 ккал») when the
 * estimate is soft; keep a single number for high-confidence / barcode hits.
 */

export type CalorieEstimateBand = {
  low: number;
  high: number;
  /** True when we should show one number, not a range. */
  exact: boolean;
};

/** Half-width as a fraction of kcal, from confidence. */
export function calorieUncertaintyRatio(confidence: number): number {
  if (!Number.isFinite(confidence)) return 0.15;
  if (confidence >= 0.85) return 0;
  if (confidence >= 0.7) return 0.08;
  if (confidence >= 0.5) return 0.12;
  return 0.18;
}

export function calorieEstimateBand(
  kcal: number,
  confidence: number,
): CalorieEstimateBand {
  if (!Number.isFinite(kcal) || kcal <= 0) {
    return { low: 0, high: 0, exact: true };
  }
  const rounded = Math.round(kcal);
  const ratio = calorieUncertaintyRatio(confidence);
  if (ratio <= 0) {
    return { low: rounded, high: rounded, exact: true };
  }
  const delta = Math.max(15, Math.round(rounded * ratio));
  // Round band edges to nearest 5 for readable «450–550».
  const low = Math.max(0, Math.round((rounded - delta) / 5) * 5);
  const high = Math.round((rounded + delta) / 5) * 5;
  if (low === high) {
    return { low, high, exact: true };
  }
  return { low, high, exact: false };
}

export function formatCalorieEstimate(kcal: number, confidence: number): string {
  const band = calorieEstimateBand(kcal, confidence);
  if (band.low <= 0 && band.high <= 0) return "— ккал";
  if (band.exact) return `${band.low} ккал`;
  return `${band.low}–${band.high} ккал`;
}
