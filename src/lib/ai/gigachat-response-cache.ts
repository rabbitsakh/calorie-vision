import { createHash } from "crypto";

const CACHE_EPOCH = "1";
const DEFAULT_TTL_MS = 10 * 60 * 1000;
const MAX_ENTRIES = 100;

type CacheEntry = {
  value: string;
  expiresAt: number;
};

const cache = new Map<string, CacheEntry>();

function cacheEnabled(): boolean {
  return process.env.GIGACHAT_RESPONSE_CACHE !== "0";
}

export function gigachatResponseCacheTtlMs(nowRaw = process.env.GIGACHAT_RESPONSE_CACHE_TTL_MS): number {
  const trimmed = nowRaw?.trim();
  if (!trimmed) return DEFAULT_TTL_MS;
  const parsed = Number(trimmed);
  if (!Number.isFinite(parsed) || parsed < 1000) return DEFAULT_TTL_MS;
  return Math.min(24 * 60 * 60 * 1000, Math.floor(parsed));
}

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value) ?? "null";
  }
  if (Array.isArray(value)) {
    return `[${value.map((item) => stableStringify(item)).join(",")}]`;
  }
  const record = value as Record<string, unknown>;
  const keys = Object.keys(record).sort();
  return `{${keys.map((key) => `${JSON.stringify(key)}:${stableStringify(record[key])}`).join(",")}}`;
}

function hashParts(parts: string[]): string {
  return createHash("sha256").update(parts.join("\0")).digest("hex");
}

export function chatResponseCacheKey(input: {
  model: string;
  temperature: number;
  messages: unknown;
}): string {
  return hashParts([
    "chat",
    CACHE_EPOCH,
    input.model,
    String(input.temperature),
    stableStringify(input.messages),
  ]);
}

export function visionResultCacheKey(input: {
  model: string;
  variant: string;
  hints: unknown;
  image: Buffer;
}): string {
  const imageHash = createHash("sha256").update(input.image).digest("hex");
  return hashParts([
    "vision",
    CACHE_EPOCH,
    input.model,
    input.variant,
    stableStringify(input.hints),
    imageHash,
  ]);
}

export function readResponseCache(key: string, now = Date.now()): string | null {
  if (!cacheEnabled()) return null;
  const entry = cache.get(key);
  if (!entry) return null;
  if (entry.expiresAt <= now) {
    cache.delete(key);
    return null;
  }
  return entry.value;
}

export function writeResponseCache(key: string, value: string, now = Date.now()): void {
  if (!cacheEnabled()) return;
  cache.set(key, {
    value,
    expiresAt: now + gigachatResponseCacheTtlMs(),
  });

  if (cache.size <= MAX_ENTRIES) return;
  const cutoff = now;
  for (const [cachedKey, entry] of cache) {
    if (entry.expiresAt <= cutoff) cache.delete(cachedKey);
  }
  while (cache.size > MAX_ENTRIES) {
    const oldest = cache.keys().next().value;
    if (oldest === undefined) break;
    cache.delete(oldest);
  }
}

export function resetResponseCacheForTests(): void {
  cache.clear();
}
