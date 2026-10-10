/**
 * Last-known NextAuth session for offline AuthGate soft-pass.
 * Cleared on sign-out. Not a substitute for real cookies when online.
 */

export const OFFLINE_SESSION_CACHE_KEY = "cv-offline-session-v1";

export type OfflineSessionUser = {
  id?: string;
  name?: string | null;
  email?: string | null;
  image?: string | null;
};

export type OfflineSessionCache = {
  user: OfflineSessionUser;
  expires?: string | null;
  cachedAt: string;
};

type CvSessionBridge = {
  get: (key: string) => string | null;
  set: (key: string, value: string) => void;
  remove: (key: string) => void;
};

function cvSession(): CvSessionBridge | null {
  if (typeof window === "undefined") return null;
  try {
    const bridge = (window as Window & { CvSession?: CvSessionBridge }).CvSession;
    if (bridge && typeof bridge.get === "function" && typeof bridge.set === "function") {
      return bridge;
    }
  } catch {
    // ignore
  }
  return null;
}

function readRaw(): string | null {
  if (typeof window === "undefined") return null;
  try {
    const native = cvSession();
    if (native) {
      const v = native.get(OFFLINE_SESSION_CACHE_KEY);
      if (v) return v;
    }
    return localStorage.getItem(OFFLINE_SESSION_CACHE_KEY);
  } catch {
    return null;
  }
}

function writeRaw(value: string | null): void {
  if (typeof window === "undefined") return;
  try {
    const native = cvSession();
    if (value == null) {
      native?.remove(OFFLINE_SESSION_CACHE_KEY);
      localStorage.removeItem(OFFLINE_SESSION_CACHE_KEY);
      return;
    }
    native?.set(OFFLINE_SESSION_CACHE_KEY, value);
    localStorage.setItem(OFFLINE_SESSION_CACHE_KEY, value);
  } catch {
    // quota / private mode
  }
}

export function readOfflineSessionCache(): OfflineSessionCache | null {
  const raw = readRaw();
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object") return null;
    const rec = parsed as OfflineSessionCache;
    if (!rec.user || typeof rec.user !== "object") return null;
    if (typeof rec.cachedAt !== "string") return null;
    return rec;
  } catch {
    return null;
  }
}

/** Persist a minimal session snapshot after a successful authenticated load. */
export function writeOfflineSessionCache(session: {
  user?: OfflineSessionUser | null;
  expires?: string | null;
} | null): void {
  if (!session?.user) return;
  const payload: OfflineSessionCache = {
    user: {
      id: typeof session.user.id === "string" ? session.user.id : undefined,
      name: session.user.name ?? null,
      email: session.user.email ?? null,
      image: session.user.image ?? null,
    },
    expires: session.expires ?? null,
    cachedAt: new Date().toISOString(),
  };
  writeRaw(JSON.stringify(payload));
}

export function clearOfflineSessionCache(): void {
  writeRaw(null);
}

/** True when a usable offline snapshot exists (any age — soft-pass only when offline). */
export function hasOfflineSessionCache(): boolean {
  return readOfflineSessionCache() != null;
}
