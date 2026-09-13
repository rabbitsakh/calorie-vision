/**
 * Client mirror of account quiet hours — used so celebrations (not only push)
 * can respect the same window without an extra network round-trip each time.
 *
 * Hours are evaluated in the account timezone (same as push cron), falling back
 * to the device IANA zone when the account TZ has not been hydrated yet.
 */

import { detectDeviceTimezone } from "./device-timezone";
import { withBasePath } from "./paths";
import { localHour, resolvePushTimezone } from "./push-reminders";
import { clampHour, isInQuietHours } from "./quiet-hours";

export const QUIET_HOURS_START_KEY = "cv-quiet-hours-start";
export const QUIET_HOURS_END_KEY = "cv-quiet-hours-end";
export const QUIET_HOURS_TZ_KEY = "cv-quiet-hours-tz";

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

/** Mirror account timezone so celebration quiet hours match push cron. */
export function syncQuietHoursTimezone(timezone: string | null | undefined): void {
  const storage = getLocalStorage();
  if (!storage) return;
  try {
    const trimmed = timezone?.trim();
    if (!trimmed) {
      storage.removeItem(QUIET_HOURS_TZ_KEY);
      return;
    }
    storage.setItem(QUIET_HOURS_TZ_KEY, resolvePushTimezone(trimmed));
  } catch {
    // ignore
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

export function getQuietHoursTimezone(): string | null {
  const storage = getLocalStorage();
  if (!storage) return null;
  try {
    const raw = storage.getItem(QUIET_HOURS_TZ_KEY)?.trim();
    return raw ? resolvePushTimezone(raw) : null;
  } catch {
    return null;
  }
}

/**
 * Local hour for quiet-hours checks: account TZ → device IANA → wall clock.
 * Matches push cron's resolvePushTimezone + localHour path.
 */
export function quietHoursLocalHour(now = new Date()): number {
  const cached = getQuietHoursTimezone();
  const tz = resolvePushTimezone(cached ?? detectDeviceTimezone());
  return localHour(tz, now);
}

/** True when the account-local clock falls inside the user's quiet-hours window. */
export function areCelebrationsInQuietHours(now = new Date()): boolean {
  const { start, end } = getQuietHoursPrefs();
  return isInQuietHours(quietHoursLocalHour(now), start, end);
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
        timezone?: string | null;
      };
      syncQuietHoursPrefs(data.quietHoursStart ?? null, data.quietHoursEnd ?? null);
      syncQuietHoursTimezone(data.timezone ?? null);
    } catch {
      // non-critical — celebrations stay unmuted until prefs sync
    }
  })();
}
