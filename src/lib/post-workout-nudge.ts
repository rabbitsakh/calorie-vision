/** Soft post-workout → ration protein nudge (localStorage, ~6h; migrates from sessionStorage). */

export const POST_WORKOUT_AT_KEY = "cv-post-workout-at";
/** Soft protein fraction that retires the post-workout nudge. */
export const POST_WORKOUT_PROTEIN_RATIO = 0.7;
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

/** Protein already at/above soft target — nudge is done without a CTA click. */
export function shouldClearPostWorkoutNudge(input: {
  protein: number;
  proteinTarget: number;
  /** Fraction of target that counts as enough (default POST_WORKOUT_PROTEIN_RATIO). */
  ratio?: number;
}): boolean {
  const target = input.proteinTarget;
  if (!(target > 0)) return false;
  const ratio = input.ratio ?? POST_WORKOUT_PROTEIN_RATIO;
  return input.protein >= target * ratio;
}

/**
 * Defer quest-chest auto-claim while the post-workout protein step is still open
 * (avoids stacking chest + NextStepBar for the same moment).
 */
export function shouldDeferQuestChestForPostWorkout(input: {
  protein: number;
  proteinTarget: number;
  now?: number;
}): boolean {
  if (!hasFreshPostWorkoutNudge(input.now)) return false;
  if (!(input.proteinTarget > 0)) return false;
  return !shouldClearPostWorkoutNudge(input);
}
