import type { RationDayPayload } from "@/components/RationDayProvider";

export const RATION_DAY_CACHE_KEY = "cv-ration-day-cache-v1";
const MAX_CACHED_DAYS = 4;

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
  const store = readStore();
  store[payload.date] = payload;
  writeStore(store);
}
