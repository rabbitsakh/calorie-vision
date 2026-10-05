/**
 * Quiet gamification preference — suppresses fullscreen / soft celebrations.
 * Adult product default: quiet ON unless the user explicitly opts into celebrations.
 * Stored in localStorage (`gamificationQuiet`): "1" | "0" | unset(=quiet).
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

/**
 * True when celebrations should stay quiet.
 * Unset → quiet (adult default). Explicit "0" → celebrations on.
 */
export function isGamificationQuiet(): boolean {
  const storage = getLocalStorage();
  if (!storage) return true;
  try {
    const value = storage.getItem(GAMIFICATION_QUIET_KEY);
    if (value === "0") return false;
    return true;
  } catch {
    return true;
  }
}

export function setGamificationQuiet(quiet: boolean): void {
  const storage = getLocalStorage();
  if (!storage) return;
  try {
    storage.setItem(GAMIFICATION_QUIET_KEY, quiet ? "1" : "0");
  } catch {
    // ignore quota / private mode
  }
}

export const QUIET_DEFAULT_APPLIED_KEY = "cv-quiet-default-applied-v2";

/**
 * Persist explicit quiet for users who never chose — so profile toggle
 * shows the real adult default. Opt-out ("0") is respected.
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

/**
 * One-shot migrate: existing users without an explicit opt-in to celebrations
 * get quiet (adult visible wave). Users who already set "0" keep celebrations.
 */
export function ensureAdultQuietDefault(): void {
  const storage = getLocalStorage();
  if (!storage) return;
  try {
    if (storage.getItem(QUIET_DEFAULT_APPLIED_KEY) === "1") return;
    const current = storage.getItem(GAMIFICATION_QUIET_KEY);
    if (current !== "0") {
      storage.setItem(GAMIFICATION_QUIET_KEY, "1");
    }
    storage.setItem(QUIET_DEFAULT_APPLIED_KEY, "1");
  } catch {
    // ignore
  }
}
