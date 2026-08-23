/** Once-per-day / once-per-week soft celebration flags in localStorage. */

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
  | "weight-target";

function storageKey(kind: SoftCelebrationKind, date: string): string {
  return `soft-celeb-${kind}-${date}`;
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
