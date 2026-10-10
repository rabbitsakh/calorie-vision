/**
 * Last successful /api/account payload for offline profile view.
 */

export const OFFLINE_ACCOUNT_CACHE_KEY = "cv-offline-account-v1";

export type OfflineAccountCache = {
  cachedAt: string;
  account: Record<string, unknown>;
};

function readRaw(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return localStorage.getItem(OFFLINE_ACCOUNT_CACHE_KEY);
  } catch {
    return null;
  }
}

function writeRaw(value: string | null): void {
  if (typeof window === "undefined") return;
  try {
    if (value == null) {
      localStorage.removeItem(OFFLINE_ACCOUNT_CACHE_KEY);
    } else {
      localStorage.setItem(OFFLINE_ACCOUNT_CACHE_KEY, value);
    }
  } catch {
    // quota / private mode
  }
}

export function readOfflineAccountCache<T extends Record<string, unknown>>(): T | null {
  const raw = readRaw();
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as OfflineAccountCache;
    if (!parsed?.account || typeof parsed.account !== "object") return null;
    return parsed.account as T;
  } catch {
    return null;
  }
}

export function writeOfflineAccountCache(account: Record<string, unknown>): void {
  if (!account || typeof account !== "object") return;
  const { error: _err, ...rest } = account;
  writeRaw(
    JSON.stringify({
      cachedAt: new Date().toISOString(),
      account: rest,
    } satisfies OfflineAccountCache),
  );
}

export function clearOfflineAccountCache(): void {
  writeRaw(null);
}
