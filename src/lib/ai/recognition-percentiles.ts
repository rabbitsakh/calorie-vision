/** Nearest-rank percentile (0..100) on a numeric sample. */
export function percentile(values: readonly number[], p: number): number | null {
  if (values.length === 0 || !Number.isFinite(p)) {
    return null;
  }

  const sorted = [...values].filter((value) => Number.isFinite(value)).sort((a, b) => a - b);
  if (sorted.length === 0) {
    return null;
  }

  const clamped = Math.min(100, Math.max(0, p));
  const index = Math.ceil((clamped / 100) * sorted.length) - 1;
  return sorted[Math.max(0, index)] ?? null;
}

export type LatencySummary = {
  count: number;
  p50Ms: number | null;
  p95Ms: number | null;
  maxMs: number | null;
};

export function summarizeLatencyMs(values: readonly number[]): LatencySummary {
  const samples = values.filter((value) => Number.isFinite(value) && value >= 0);
  return {
    count: samples.length,
    p50Ms: percentile(samples, 50),
    p95Ms: percentile(samples, 95),
    maxMs: samples.length > 0 ? Math.max(...samples) : null,
  };
}
