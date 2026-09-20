/** Shared parsers for workout set create/update bodies. */

export function parseStrengthWeight(raw: unknown): number | null {
  const n = typeof raw === "number" ? raw : Number(raw);
  if (!Number.isFinite(n) || n < 0 || n > 1000) return null;
  return n;
}

export function parseStrengthReps(raw: unknown): number | null {
  const n = typeof raw === "number" ? raw : Number(raw);
  if (!Number.isFinite(n) || n <= 0 || n > 500) return null;
  const whole = Math.floor(n);
  if (whole !== n) return null;
  return whole;
}

export function parseCardioDistanceKm(raw: unknown): number | null {
  const n = typeof raw === "number" ? raw : Number(raw);
  if (!Number.isFinite(n) || n < 0 || n > 500) return null;
  return Math.round(n * 1000) / 1000;
}

export function parseCardioDurationSec(raw: unknown): number | null {
  const n = typeof raw === "number" ? raw : Number(raw);
  if (!Number.isFinite(n) || n <= 0 || n > 24 * 3600) return null;
  return Math.round(n);
}
