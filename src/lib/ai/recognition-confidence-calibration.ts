export type ConfidenceBucketStat = {
  bucketMin: number;
  bucketMax: number;
  count: number;
  correctedCount: number;
  correctionRate: number;
};

export const DEFAULT_LOW_CONFIDENCE_THRESHOLD = 0.55;

export function buildConfidenceBuckets(
  rows: Array<{ confidence: number; wasCorrected: boolean }>,
  step = 0.1,
): ConfidenceBucketStat[] {
  const buckets = new Map<number, { count: number; corrected: number }>();

  for (const row of rows) {
    if (!Number.isFinite(row.confidence) || row.confidence < 0 || row.confidence > 1) {
      continue;
    }

    const bucketMin = Math.floor(row.confidence / step) * step;
    const bucket = buckets.get(bucketMin) ?? { count: 0, corrected: 0 };
    bucket.count += 1;
    if (row.wasCorrected) {
      bucket.corrected += 1;
    }
    buckets.set(bucketMin, bucket);
  }

  return [...buckets.entries()]
    .sort((left, right) => left[0] - right[0])
    .map(([bucketMin, stats]) => ({
      bucketMin,
      bucketMax: Math.min(1, Math.round((bucketMin + step) * 100) / 100),
      count: stats.count,
      correctedCount: stats.corrected,
      correctionRate: stats.count > 0 ? Math.round((stats.corrected / stats.count) * 100) : 0,
    }));
}

export function suggestLowConfidenceThreshold(
  buckets: ConfidenceBucketStat[],
  overallCorrectionRate: number,
  fallback = DEFAULT_LOW_CONFIDENCE_THRESHOLD,
): number {
  if (buckets.length === 0) {
    return fallback;
  }

  const risky = buckets.find(
    (bucket) => bucket.count >= 5 && bucket.correctionRate >= overallCorrectionRate + 10,
  );
  if (risky) {
    return Math.max(0.45, Math.min(0.75, risky.bucketMax));
  }

  return fallback;
}
