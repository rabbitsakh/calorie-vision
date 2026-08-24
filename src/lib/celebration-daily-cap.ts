/** Max fullscreen celebrations per local calendar day (localStorage). */

export const FS_CELEB_DAILY_CAP = 2;

function storageKey(date: string): string {
  return `cv-fs-celeb-daily-${date}`;
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

/** Local YYYY-MM-DD for the celebration daily cap. */
export function celebrationCapDateKey(now = new Date()): string {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function getFullscreenCelebrationCount(date = celebrationCapDateKey()): number {
  const storage = getLocalStorage();
  if (!storage) return FS_CELEB_DAILY_CAP;
  try {
    const raw = storage.getItem(storageKey(date));
    const n = raw ? Number(raw) : 0;
    return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0;
  } catch {
    return FS_CELEB_DAILY_CAP;
  }
}

export function isFullscreenCelebrationCapReached(date = celebrationCapDateKey()): boolean {
  return getFullscreenCelebrationCount(date) >= FS_CELEB_DAILY_CAP;
}

/**
 * Reserve one fullscreen celebration slot for today.
 * @returns false if the daily cap is already reached.
 */
export function consumeFullscreenCelebrationSlot(date = celebrationCapDateKey()): boolean {
  const storage = getLocalStorage();
  if (!storage) return false;
  try {
    const current = getFullscreenCelebrationCount(date);
    if (current >= FS_CELEB_DAILY_CAP) return false;
    storage.setItem(storageKey(date), String(current + 1));
    return true;
  } catch {
    return false;
  }
}
