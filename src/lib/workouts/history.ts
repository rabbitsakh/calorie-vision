import { normalizeExerciseName } from "@/lib/workouts/exercise-name";

export type HistorySet = {
  weightKg: number;
  reps: number;
};

export type ExerciseHistoryEntry = {
  date: string;
  sessionId: string;
  sets: HistorySet[];
};

type HistorySourceExercise = {
  id: string;
  name: string;
  sets: Array<{ weightKg: number; reps: number; sortOrder: number }>;
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
        .map((s) => ({ weightKg: s.weightKg, reps: s.reps }));
      if (sets.length === 0) continue;
      out.set(key, { date: session.date, sessionId: session.id, sets });
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
