import { normalizeExerciseName, pickBestNameMatch } from "@/lib/workouts/exercise-name";
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
  catalogId?: string | null;
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

export type ExerciseHistoryIndex = {
  byName: Map<string, ExerciseHistoryEntry>;
  byCatalog: Map<string, ExerciseHistoryEntry>;
};

/**
 * Последняя запись движения: по названию и отдельно по catalogId.
 * Сессии идут от новых к старым, первое попадание и есть «прошлый раз».
 */
export function buildExerciseHistoryIndex(
  historySessions: readonly HistorySourceSession[],
  options?: { excludeSessionId?: string },
): ExerciseHistoryIndex {
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

  const byName = new Map<string, ExerciseHistoryEntry>();
  const byCatalog = new Map<string, ExerciseHistoryEntry>();
  for (const session of sorted) {
    for (const ex of session.exercises) {
      const sets = [...ex.sets]
        .sort((a, b) => a.sortOrder - b.sortOrder)
        .map((s) => ({
          weightKg: s.weightKg,
          reps: s.reps,
          distanceKm: s.distanceKm ?? null,
          durationSec: s.durationSec ?? null,
        }));
      if (sets.length === 0) continue;
      const entry: ExerciseHistoryEntry = {
        date: session.date,
        sessionId: session.id,
        kind: parseExerciseKind(ex.kind),
        sets,
      };
      const key = normalizeExerciseName(ex.name);
      if (key && !byName.has(key)) byName.set(key, entry);
      const catalogId = ex.catalogId?.trim();
      if (catalogId && !byCatalog.has(catalogId)) byCatalog.set(catalogId, entry);
    }
  }
  return { byName, byCatalog };
}

/**
 * Map normalized exercise name → last prior logging (excluding current session).
 */
export function buildExerciseHistoryByNormName(
  historySessions: readonly HistorySourceSession[],
  options?: { excludeSessionId?: string },
): Map<string, ExerciseHistoryEntry> {
  return buildExerciseHistoryIndex(historySessions, options).byName;
}

export function historyForExercise(
  index: ExerciseHistoryIndex,
  exercise: { name: string; catalogId?: string | null },
): ExerciseHistoryEntry | null {
  const catalogId = exercise.catalogId?.trim();
  if (catalogId) {
    const byCatalog = index.byCatalog.get(catalogId);
    if (byCatalog) return byCatalog;
  }
  return historyForExerciseName(index.byName, exercise.name);
}

export function historyForExerciseName(
  byNorm: Map<string, ExerciseHistoryEntry>,
  name: string,
): ExerciseHistoryEntry | null {
  const key = normalizeExerciseName(name);
  if (!key) return null;
  const exact = byNorm.get(key);
  if (exact) return exact;
  const rows = [...byNorm.entries()].map(([nameNorm, entry]) => ({ nameNorm, entry }));
  return pickBestNameMatch(rows, name)?.entry ?? null;
}
