/** Soft post-workout → ration protein nudge (sessionStorage, ~6h). */

export const POST_WORKOUT_AT_KEY = "cv-post-workout-at";
const MAX_AGE_MS = 6 * 60 * 60 * 1000;

export function markPostWorkoutNudge(now = Date.now()): void {
  if (typeof sessionStorage === "undefined") return;
  try {
    sessionStorage.setItem(POST_WORKOUT_AT_KEY, String(now));
  } catch {
    // ignore
  }
}

/** True when a recent finished workout still needs a protein/kcal nudge. */
export function hasFreshPostWorkoutNudge(now = Date.now()): boolean {
  if (typeof sessionStorage === "undefined") return false;
  try {
    const raw = sessionStorage.getItem(POST_WORKOUT_AT_KEY);
    if (!raw) return false;
    const at = Number(raw);
    if (!Number.isFinite(at) || at <= 0) return false;
    return now - at <= MAX_AGE_MS;
  } catch {
    return false;
  }
}

export function clearPostWorkoutNudge(): void {
  if (typeof sessionStorage === "undefined") return;
  try {
    sessionStorage.removeItem(POST_WORKOUT_AT_KEY);
  } catch {
    // ignore
  }
}
