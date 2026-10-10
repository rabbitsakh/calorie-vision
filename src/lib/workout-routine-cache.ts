/**
 * Cache workout routines (with exercises + planned sets) for offline start (Wave Q).
 */

import type { SerializedRoutine } from "@/lib/workouts/routines";

export const WORKOUT_ROUTINES_CACHE_KEY = "cv-workout-routines-cache-v1";

function isRoutine(value: unknown): value is SerializedRoutine {
  if (value == null || typeof value !== "object") return false;
  const r = value as SerializedRoutine;
  return (
    typeof r.id === "string" &&
    typeof r.name === "string" &&
    Array.isArray(r.muscleKeys) &&
    Array.isArray(r.exercises)
  );
}

export function writeWorkoutRoutinesCache(routines: SerializedRoutine[]): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(
      WORKOUT_ROUTINES_CACHE_KEY,
      JSON.stringify({ at: Date.now(), routines: routines.slice(0, 40) }),
    );
  } catch {
    // quota
  }
}

export function readWorkoutRoutinesCache(): SerializedRoutine[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(WORKOUT_ROUTINES_CACHE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as { routines?: unknown };
    if (!Array.isArray(parsed.routines)) return [];
    return parsed.routines.filter(isRoutine);
  } catch {
    return [];
  }
}

export function getCachedWorkoutRoutine(id: string): SerializedRoutine | null {
  return readWorkoutRoutinesCache().find((r) => r.id === id) ?? null;
}
