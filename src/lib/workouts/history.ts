import { normalizeExerciseName } from "@/lib/workouts/exercise-name";
import { parseExerciseKind, type ExerciseKind } from "@/lib/workouts/exercise-kind";

export type HistorySet = {
  weightKg: number | null;
  reps: number | null;
  distanceKm: number | null;
  durationSec: number | null;
};

export type ExerciseHistoryEntry = {
  date: string;
  sessionId: string;
  kind: ExerciseKind;
  sets: HistorySet[];
};

type HistorySourceExercise = {
  id: string;
  name: string;
  kind?: string | null;
  sets: Array<{
    weightKg: number | null;
    reps: number | null;
    distanceKm?: number | null;
    durationSec?: number | null;
    sortOrder: number;
  }>;
};

type HistorySourceSession = {
  id: string;
  date: string;
  createdAt: Date | string;
  exercises: HistorySourceExercise[];
};

/**
 * Map normalized exercise name → last prior logging (excluding current session).
 */
export function buildExerciseHistoryByNormName(
  historySessions: readonly HistorySourceSession[],
  options?: { excludeSessionId?: string },
): Map<string, ExerciseHistoryEntry> {
  const sorted = historySessions
    .filter((s) => s.id !== options?.excludeSessionId)
    .slice()
    .sort((a, b) => {
      const d = b.date.localeCompare(a.date);
      if (d !== 0) return d;
      const ta = a.createdAt instanceof Date ? a.createdAt.getTime() : new Date(a.createdAt).getTime();
      const tb = b.createdAt instanceof Date ? b.createdAt.getTime() : new Date(b.createdAt).getTime();
      return tb - ta;
    });

  const out = new Map<string, ExerciseHistoryEntry>();
  for (const session of sorted) {
    for (const ex of session.exercises) {
      const key = normalizeExerciseName(ex.name);
      if (!key || out.has(key)) continue;
      const sets = [...ex.sets]
        .sort((a, b) => a.sortOrder - b.sortOrder)
        .map((s) => ({
          weightKg: s.weightKg,
          reps: s.reps,
          distanceKm: s.distanceKm ?? null,
          durationSec: s.durationSec ?? null,
        }));
      if (sets.length === 0) continue;
      out.set(key, {
        date: session.date,
        sessionId: session.id,
        kind: parseExerciseKind(ex.kind),
        sets,
      });
    }
  }
  return out;
}

export function historyForExerciseName(
  byNorm: Map<string, ExerciseHistoryEntry>,
  name: string,
): ExerciseHistoryEntry | null {
  return byNorm.get(normalizeExerciseName(name)) ?? null;
}
