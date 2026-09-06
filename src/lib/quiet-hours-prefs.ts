/**
 * Client mirror of account quiet hours — used so celebrations (not only push)
 * can respect the same window without an extra network round-trip each time.
 */

import { clampHour, isInQuietHours } from "./quiet-hours";
import { withBasePath } from "./paths";

export const QUIET_HOURS_START_KEY = "cv-quiet-hours-start";
export const QUIET_HOURS_END_KEY = "cv-quiet-hours-end";

function getLocalStorage(): Storage | null {
  try {
    const root = globalThis as typeof globalThis & {
      window?: { localStorage?: Storage };
      localStorage?: Storage;
    };
    return root.window?.localStorage ?? root.localStorage ?? null;
  } catch {
    return null;
  }
}

function readHour(key: string): number | null {
  const storage = getLocalStorage();
  if (!storage) return null;
  try {
    return clampHour(storage.getItem(key));
  } catch {
    return null;
  }
}

/** Persist quiet hours locally after account load/save. */
export function syncQuietHoursPrefs(
  start: number | null | undefined,
  end: number | null | undefined,
): void {
  const storage = getLocalStorage();
  if (!storage) return;
  try {
    if (start == null || end == null) {
      storage.removeItem(QUIET_HOURS_START_KEY);
      storage.removeItem(QUIET_HOURS_END_KEY);
      return;
    }
    storage.setItem(QUIET_HOURS_START_KEY, String(start));
    storage.setItem(QUIET_HOURS_END_KEY, String(end));
  } catch {
    // ignore quota / private mode
  }
}

export function getQuietHoursPrefs(): {
  start: number | null;
  end: number | null;
} {
  return {
    start: readHour(QUIET_HOURS_START_KEY),
    end: readHour(QUIET_HOURS_END_KEY),
  };
}

/** True when local clock falls inside the user's quiet-hours window. */
export function areCelebrationsInQuietHours(now = new Date()): boolean {
  const { start, end } = getQuietHoursPrefs();
  return isInQuietHours(now.getHours(), start, end);
}

let hydrateStarted = false;

/**
 * One-shot hydrate from /api/account so quiet hours work before the user
 * re-opens push settings in this browser.
 */
export function hydrateQuietHoursFromAccount(): void {
  if (hydrateStarted || typeof window === "undefined") return;
  hydrateStarted = true;
  void (async () => {
    try {
      const resp = await fetch(withBasePath("/api/account"), { cache: "no-store" });
      if (!resp.ok) return;
      const data = (await resp.json()) as {
        quietHoursStart?: number | null;
        quietHoursEnd?: number | null;
      };
      syncQuietHoursPrefs(data.quietHoursStart ?? null, data.quietHoursEnd ?? null);
    } catch {
      // non-critical — celebrations stay unmuted until prefs sync
    }
  })();
}
