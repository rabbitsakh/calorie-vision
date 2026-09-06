/**
 * Quiet gamification preference — suppresses fullscreen celebrations.
 * Stored in localStorage (`gamificationQuiet`).
 */

export const GAMIFICATION_QUIET_KEY = "gamificationQuiet";

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

/** True when the user opted into quiet / low-celebration mode. */
export function isGamificationQuiet(): boolean {
  const storage = getLocalStorage();
  if (!storage) return false;
  try {
    return storage.getItem(GAMIFICATION_QUIET_KEY) === "1";
  } catch {
    return false;
  }
}

export function setGamificationQuiet(quiet: boolean): void {
  const storage = getLocalStorage();
  if (!storage) return;
  try {
    if (quiet) {
      storage.setItem(GAMIFICATION_QUIET_KEY, "1");
    } else {
      storage.removeItem(GAMIFICATION_QUIET_KEY);
    }
  } catch {
    // ignore quota / private mode
  }
}

export const QUIET_DEFAULT_APPLIED_KEY = "cv-quiet-default-applied-v1";

/**
 * First onboarding completion: enable quiet celebrations unless the user
 * already chose a preference. Existing users who never hit finish again
 * are left unchanged.
 */
export function ensureQuietDefaultForNewUsers(): void {
  const storage = getLocalStorage();
  if (!storage) return;
  try {
    if (storage.getItem(QUIET_DEFAULT_APPLIED_KEY) === "1") return;
    if (storage.getItem(GAMIFICATION_QUIET_KEY) == null) {
      storage.setItem(GAMIFICATION_QUIET_KEY, "1");
    }
    storage.setItem(QUIET_DEFAULT_APPLIED_KEY, "1");
  } catch {
    // ignore
  }
}
