/** Soft post-workout → ration protein nudge (localStorage, ~6h; migrates from sessionStorage). */

export const POST_WORKOUT_AT_KEY = "cv-post-workout-at";
const MAX_AGE_MS = 6 * 60 * 60 * 1000;

function readStore(): Storage | null {
  try {
    if (typeof localStorage !== "undefined") return localStorage;
  } catch {
    // ignore
  }
  try {
    if (typeof sessionStorage !== "undefined") return sessionStorage;
  } catch {
    // ignore
  }
  return null;
}

function migrateFromSession(): void {
  try {
    if (typeof sessionStorage === "undefined" || typeof localStorage === "undefined") return;
    const legacy = sessionStorage.getItem(POST_WORKOUT_AT_KEY);
    if (!legacy) return;
    if (!localStorage.getItem(POST_WORKOUT_AT_KEY)) {
      localStorage.setItem(POST_WORKOUT_AT_KEY, legacy);
    }
    sessionStorage.removeItem(POST_WORKOUT_AT_KEY);
  } catch {
    // ignore
  }
}

export function markPostWorkoutNudge(now = Date.now()): void {
  const store = readStore();
  if (!store) return;
  try {
    store.setItem(POST_WORKOUT_AT_KEY, String(now));
    // Prefer durable storage when both exist.
    if (typeof localStorage !== "undefined" && store !== localStorage) {
      localStorage.setItem(POST_WORKOUT_AT_KEY, String(now));
    }
  } catch {
    // ignore
  }
}

/** True when a recent finished workout still needs a protein/kcal nudge. */
export function hasFreshPostWorkoutNudge(now = Date.now()): boolean {
  migrateFromSession();
  const store = readStore();
  if (!store) return false;
  try {
    const raw = store.getItem(POST_WORKOUT_AT_KEY);
    if (!raw) return false;
    const at = Number(raw);
    if (!Number.isFinite(at) || at <= 0) return false;
    return now - at <= MAX_AGE_MS;
  } catch {
    return false;
  }
}

export function clearPostWorkoutNudge(): void {
  try {
    localStorage?.removeItem(POST_WORKOUT_AT_KEY);
  } catch {
    // ignore
  }
  try {
    sessionStorage?.removeItem(POST_WORKOUT_AT_KEY);
  } catch {
    // ignore
  }
}
