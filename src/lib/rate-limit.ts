type Bucket = {
  count: number;
  resetAtMs: number;
};

const buckets = new Map<string, Bucket>();

/** Sliding-window rate limiter (in-memory, per process). */
export function checkRateLimit(
  key: string,
  limit: number,
  windowMs: number,
  nowMs = Date.now(),
): { allowed: boolean; retryAfterSec: number } {
  const bucket = buckets.get(key);
  if (!bucket || nowMs >= bucket.resetAtMs) {
    buckets.set(key, { count: 1, resetAtMs: nowMs + windowMs });
    return { allowed: true, retryAfterSec: 0 };
  }

  if (bucket.count >= limit) {
    return {
      allowed: false,
      retryAfterSec: Math.max(1, Math.ceil((bucket.resetAtMs - nowMs) / 1000)),
    };
  }

  bucket.count += 1;
  return { allowed: true, retryAfterSec: 0 };
}

/** Test helper — reset all buckets. */
export function resetRateLimitsForTests(): void {
  buckets.clear();
}
