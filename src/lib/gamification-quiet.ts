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
