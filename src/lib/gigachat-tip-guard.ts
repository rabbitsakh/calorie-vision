/**
 * Guard GigaChat tip / suggestion routes: shared rate limit + short/day cache.
 * Redis when REDIS_URL is set; otherwise in-memory (same process).
 */

import { checkRateLimitAsync, type RateLimitResult } from "@/lib/rate-limit";
import { redisGet, redisSetEx } from "@/lib/rate-limit-redis";

type MemoryEntry = { expiresAtMs: number; payload: string };
const memoryCache = new Map<string, MemoryEntry>();

export function resetTipGuardForTests(): void {
  memoryCache.clear();
}

function pruneMemory(nowMs: number) {
  if (memoryCache.size < 200) return;
  for (const [k, v] of memoryCache) {
    if (v.expiresAtMs <= nowMs) memoryCache.delete(k);
  }
}

export async function readTipCache<T>(key: string, nowMs = Date.now()): Promise<T | null> {
  const redisKey = `cv:tip:${key}`;
  const fromRedis = await redisGet(redisKey);
  if (fromRedis) {
    try {
      return JSON.parse(fromRedis) as T;
    } catch {
      return null;
    }
  }
  const hit = memoryCache.get(redisKey);
  if (!hit || hit.expiresAtMs <= nowMs) {
    if (hit) memoryCache.delete(redisKey);
    return null;
  }
  try {
    return JSON.parse(hit.payload) as T;
  } catch {
    memoryCache.delete(redisKey);
    return null;
  }
}

export async function writeTipCache(
  key: string,
  value: unknown,
  ttlSec: number,
  nowMs = Date.now(),
): Promise<void> {
  const redisKey = `cv:tip:${key}`;
  const payload = JSON.stringify(value);
  const ttl = Math.max(30, Math.floor(ttlSec));
  if (await redisSetEx(redisKey, payload, ttl)) return;
  pruneMemory(nowMs);
  memoryCache.set(redisKey, { payload, expiresAtMs: nowMs + ttl * 1000 });
}

/** Seconds until ~04:00 next UTC day (soft daily tip refresh). */
export function tipCacheTtlSec(nowMs = Date.now()): number {
  const dayMs = 24 * 60 * 60 * 1000;
  const elapsed = nowMs % dayMs;
  const until = dayMs - elapsed + 4 * 60 * 60 * 1000;
  return Math.max(60 * 30, Math.min(Math.floor(until / 1000), 36 * 60 * 60));
}

export type TipGuardKind =
  | "motivation-tip"
  | "suggestions"
  | "workouts-next-tip"
  | "weekly-digest-tip";

const LIMITS: Record<TipGuardKind, { limit: number; windowMs: number }> = {
  "motivation-tip": { limit: 8, windowMs: 60 * 60_000 },
  suggestions: { limit: 20, windowMs: 60 * 60_000 },
  "workouts-next-tip": { limit: 30, windowMs: 60 * 60_000 },
  "weekly-digest-tip": { limit: 8, windowMs: 60 * 60_000 },
};

export async function checkTipRateLimit(
  kind: TipGuardKind,
  userId: string,
): Promise<RateLimitResult> {
  const cfg = LIMITS[kind];
  return checkRateLimitAsync(`gigachat-tip:${kind}:${userId}`, cfg.limit, cfg.windowMs);
}

export function tipRateLimitBody(retryAfterSec: number) {
  return {
    error: `Слишком много запросов к AI-советам. Подождите ${retryAfterSec} сек.`,
    retryAfterSec,
  };
}
