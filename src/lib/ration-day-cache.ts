import type { RationDayPayload } from "@/components/RationDayProvider";

export const RATION_DAY_CACHE_KEY = "cv-ration-day-cache-v2";
/** Старые снимки дня (в том числе с завышенным расходом зала) больше не читаем. */
const LEGACY_RATION_DAY_CACHE_KEYS = ["cv-ration-day-cache-v1"];
/** Keep a full week + today so offline date swipes still hit cache. */
const MAX_CACHED_DAYS = 8;

type CacheStore = Record<string, RationDayPayload>;

function readStore(): CacheStore {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(RATION_DAY_CACHE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
    return parsed as CacheStore;
  } catch {
    return {};
  }
}

function writeStore(store: CacheStore): void {
  if (typeof window === "undefined") return;
  try {
    const keys = Object.keys(store).sort();
    const trimmed: CacheStore = {};
    for (const key of keys.slice(-MAX_CACHED_DAYS)) {
      trimmed[key] = store[key]!;
    }
    localStorage.setItem(RATION_DAY_CACHE_KEY, JSON.stringify(trimmed));
  } catch {
    // quota / private mode
  }
}

export function readRationDayCache(date: string): RationDayPayload | null {
  const hit = readStore()[date];
  if (!hit || hit.date !== date) return null;
  return hit;
}

export function writeRationDayCache(payload: RationDayPayload): void {
  if (!payload?.date) return;
  dropLegacyCache();
  const store = readStore();
  store[payload.date] = payload;
  writeStore(store);
}

/** Убрать снимок дня, чтобы следующий запрос посчитал норму и воду заново. */
export function invalidateRationDayCache(date?: string): void {
  if (typeof window === "undefined") return;
  dropLegacyCache();
  const store = readStore();
  if (date) delete store[date];
  else {
    for (const key of Object.keys(store)) delete store[key];
  }
  writeStore(store);
}

function dropLegacyCache(): void {
  if (typeof window === "undefined") return;
  try {
    for (const key of LEGACY_RATION_DAY_CACHE_KEYS) localStorage.removeItem(key);
  } catch {
    // private mode
  }
}
