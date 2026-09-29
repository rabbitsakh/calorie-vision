/** Synced workout prefs (User.workoutPrefsJson) + localStorage cache. */

export type WorkoutPrefs = {
  defaultRestSec?: number;
  byExercise?: Record<string, number>;
  sound?: boolean;
};

export function parseWorkoutPrefs(raw: unknown): WorkoutPrefs | null {
  if (raw == null || typeof raw !== "object" || Array.isArray(raw)) return null;
  const o = raw as Record<string, unknown>;
  const prefs: WorkoutPrefs = {};
  if (typeof o.defaultRestSec === "number" && Number.isFinite(o.defaultRestSec) && o.defaultRestSec > 0) {
    prefs.defaultRestSec = Math.min(60 * 30, Math.round(o.defaultRestSec));
  }
  if (typeof o.sound === "boolean") {
    prefs.sound = o.sound;
  }
  if (o.byExercise && typeof o.byExercise === "object" && !Array.isArray(o.byExercise)) {
    const map: Record<string, number> = {};
    for (const [k, v] of Object.entries(o.byExercise as Record<string, unknown>)) {
      if (typeof v === "number" && Number.isFinite(v) && v > 0 && k.trim()) {
        map[k.trim().toLocaleLowerCase("ru")] = Math.min(60 * 30, Math.round(v));
      }
    }
    if (Object.keys(map).length > 0) prefs.byExercise = map;
  }
  return Object.keys(prefs).length > 0 ? prefs : null;
}

export function normalizeWorkoutPrefs(input: WorkoutPrefs | null | undefined): WorkoutPrefs | null {
  if (input == null) return null;
  return parseWorkoutPrefs(input);
}
