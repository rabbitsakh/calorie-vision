/** Once-per-day / once-per-week soft celebration flags in localStorage. */

import { isFirstWeekQuiet } from "@/lib/first-hour-trust";
import { isGamificationQuiet } from "@/lib/gamification-quiet";
import { areCelebrationsInQuietHours } from "@/lib/quiet-hours-prefs";

export type SoftCelebrationKind =
  | "day-opened"
  | "daily-goal"
  | "streak-saved"
  | "challenge-done"
  | "badge-unlock"
  | "water-goal"
  | "week-perfect"
  | "checkin-done"
  | "protein-goal"
  | "weight-target"
  | "quest-chest"
  | "referral-chest";

/** Soft cards per local day (fullscreen has its own cap of 2). */
export const SOFT_CELEB_DAILY_CAP = 3;

/** First week: at most one soft celebration so logging stays primary. */
export const SOFT_CELEB_FIRST_WEEK_CAP = 1;

function storageKey(kind: SoftCelebrationKind, date: string): string {
  return `soft-celeb-${kind}-${date}`;
}

function softCapCountKey(date: string): string {
  return `soft-celeb-daily-count-${date}`;
}

/** Effective soft-card budget for today. */
export function softCelebrationDailyCap(): number {
  return isFirstWeekQuiet() ? SOFT_CELEB_FIRST_WEEK_CAP : SOFT_CELEB_DAILY_CAP;
}

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

export function isSoftCelebrationSeen(kind: SoftCelebrationKind, date: string): boolean {
  const storage = getLocalStorage();
  if (!storage) return true;
  try {
    return storage.getItem(storageKey(kind, date)) === "1";
  } catch {
    return true;
  }
}

export function markSoftCelebrationSeen(kind: SoftCelebrationKind, date: string): void {
  const storage = getLocalStorage();
  if (!storage) return;
  try {
    storage.setItem(storageKey(kind, date), "1");
  } catch {
    // ignore
  }
}

/**
 * Quiet mode / quiet hours hide soft celebrations.
 * Call before markSoftCelebrationSeen — otherwise new users with quiet default
 * burn the once-per-day flag without ever seeing the card.
 */
export function isSoftCelebrationQuietBlocked(): boolean {
  return isGamificationQuiet() || areCelebrationsInQuietHours();
}

/** Soft cards yield while a fullscreen celebration owns the gate (wave 3). */
export function isSoftCelebrationSuppressed(opts: {
  open: boolean;
  quietBlocked?: boolean;
  fullscreenActiveId?: string | null;
}): boolean {
  const quiet = opts.quietBlocked ?? isSoftCelebrationQuietBlocked();
  return !opts.open || quiet || Boolean(opts.fullscreenActiveId);
}

function muteKey(date: string): string {
  return `soft-celeb-muted-${date}`;
}

/** User opted out of soft celebrations for the rest of the day (#33). */
export function isSoftCelebrationsMutedToday(date: string): boolean {
  const storage = getLocalStorage();
  if (!storage) return false;
  try {
    return storage.getItem(muteKey(date)) === "1";
  } catch {
    return false;
  }
}

export function muteSoftCelebrationsToday(date: string): void {
  const storage = getLocalStorage();
  if (!storage) return;
  try {
    storage.setItem(muteKey(date), "1");
  } catch {
    // ignore
  }
}

export function getSoftCelebrationCount(date: string): number {
  const storage = getLocalStorage();
  if (!storage) return softCelebrationDailyCap();
  try {
    const raw = storage.getItem(softCapCountKey(date));
    const n = raw ? Number(raw) : 0;
    return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0;
  } catch {
    return softCelebrationDailyCap();
  }
}

export function isSoftCelebrationCapReached(date: string): boolean {
  return getSoftCelebrationCount(date) >= softCelebrationDailyCap();
}

/**
 * Reserve one soft-celebration slot for the local day.
 * @returns false if the daily budget is already used.
 */
export function consumeSoftCelebrationSlot(date: string): boolean {
  const storage = getLocalStorage();
  if (!storage) return false;
  try {
    const cap = softCelebrationDailyCap();
    const current = getSoftCelebrationCount(date);
    if (current >= cap) return false;
    storage.setItem(softCapCountKey(date), String(current + 1));
    return true;
  } catch {
    return false;
  }
}
