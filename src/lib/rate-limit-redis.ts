import type { Redis } from "ioredis";

let redisClient: Redis | null | undefined;

async function getRedisClient(): Promise<Redis | null> {
  if (redisClient !== undefined) {
    return redisClient;
  }

  const url = process.env.REDIS_URL?.trim();
  if (!url) {
    redisClient = null;
    return null;
  }

  try {
    const { default: Redis } = await import("ioredis");
    redisClient = new Redis(url, {
      maxRetriesPerRequest: 1,
      enableOfflineQueue: false,
      lazyConnect: true,
    });
    await redisClient.connect();
    return redisClient;
  } catch (error) {
    console.warn("Redis rate limit unavailable, using in-memory fallback", error);
    redisClient = null;
    return null;
  }
}

export async function resetRedisClientForTests(): Promise<void> {
  if (redisClient) {
    await redisClient.quit().catch(() => undefined);
  }
  redisClient = undefined;
}

/** Fixed-window counter in Redis — shared across workers when REDIS_URL is set. */
export async function checkRateLimitRedis(
  key: string,
  limit: number,
  windowMs: number,
  _nowMs = Date.now(),
): Promise<{ allowed: boolean; retryAfterSec: number } | null> {
  const redis = await getRedisClient();
  if (!redis) {
    return null;
  }

  const redisKey = `cv:rl:${key}`;
  const ttlSec = Math.max(1, Math.ceil(windowMs / 1000));

  try {
    const count = await redis.incr(redisKey);
    if (count === 1) {
      await redis.expire(redisKey, ttlSec);
    }

    if (count > limit) {
      const ttl = await redis.ttl(redisKey);
      return {
        allowed: false,
        retryAfterSec: Math.max(1, ttl > 0 ? ttl : ttlSec),
      };
    }

    return { allowed: true, retryAfterSec: 0 };
  } catch (error) {
    console.warn("Redis rate limit failed, using in-memory fallback", error);
    return null;
  }
}

export async function resetRedisRateLimitsForTests(): Promise<void> {
  const redis = await getRedisClient();
  if (!redis) {
    return;
  }
  const keys = await redis.keys("cv:rl:*");
  if (keys.length > 0) {
    await redis.del(...keys);
  }
}
