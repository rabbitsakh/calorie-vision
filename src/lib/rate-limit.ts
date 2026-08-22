type Bucket = {
  count: number;
  resetAtMs: number;
};

const buckets = new Map<string, Bucket>();

export type RateLimitResult = {
  allowed: boolean;
  retryAfterSec: number;
};

function checkRateLimitMemory(
  key: string,
  limit: number,
  windowMs: number,
  nowMs = Date.now(),
): RateLimitResult {
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

/** Sliding-window rate limiter (in-memory, per process). */
export function checkRateLimit(
  key: string,
  limit: number,
  windowMs: number,
  nowMs = Date.now(),
): RateLimitResult {
  return checkRateLimitMemory(key, limit, windowMs, nowMs);
}

/** Shared rate limit when REDIS_URL is set; otherwise same as in-memory. */
export async function checkRateLimitAsync(
  key: string,
  limit: number,
  windowMs: number,
  nowMs = Date.now(),
): Promise<RateLimitResult> {
  const { checkRateLimitRedis } = await import("@/lib/rate-limit-redis");
  const redisResult = await checkRateLimitRedis(key, limit, windowMs, nowMs);
  if (redisResult) {
    return redisResult;
  }
  return checkRateLimitMemory(key, limit, windowMs, nowMs);
}

/** Test helper — reset all buckets. */
export function resetRateLimitsForTests(): void {
  buckets.clear();
}
