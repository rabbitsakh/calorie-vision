import { normalizeExerciseName } from "@/lib/workouts/exercise-name";
import { exerciseLoad, roundLoad } from "@/lib/workouts/load";

export type ExerciseHistoryPoint = {
  date: string;
  sessionId: string;
  exerciseId: string;
  /** Best (max) weight that day. */
  topWeightKg: number;
  /** Reps at the top-weight set (first if tie). */
  topReps: number;
  totalLoad: number;
  setCount: number;
};

type SourceSet = { weightKg: number; reps: number; sortOrder: number };
type SourceExercise = { id: string; name: string; sets: SourceSet[] };
type SourceSession = {
  id: string;
  date: string;
  createdAt: Date | string;
  exercises: SourceExercise[];
};

/** Chronological (oldest→newest) history points for one exercise name. */
export function buildExerciseTimeline(
  sessions: readonly SourceSession[],
  exerciseName: string,
  options?: { limit?: number },
): ExerciseHistoryPoint[] {
  const key = normalizeExerciseName(exerciseName);
  if (!key) return [];

  const points: ExerciseHistoryPoint[] = [];
  const sorted = sessions.slice().sort((a, b) => {
    const d = a.date.localeCompare(b.date);
    if (d !== 0) return d;
    const ta = a.createdAt instanceof Date ? a.createdAt.getTime() : new Date(a.createdAt).getTime();
    const tb = b.createdAt instanceof Date ? b.createdAt.getTime() : new Date(b.createdAt).getTime();
    return ta - tb;
  });

  for (const session of sorted) {
    const match = session.exercises.find((ex) => normalizeExerciseName(ex.name) === key);
    if (!match || match.sets.length === 0) continue;

    const sets = [...match.sets].sort((a, b) => a.sortOrder - b.sortOrder);
    let top = sets[0]!;
    for (const s of sets) {
      if (s.weightKg > top.weightKg) top = s;
    }
    points.push({
      date: session.date,
      sessionId: session.id,
      exerciseId: match.id,
      topWeightKg: top.weightKg,
      topReps: top.reps,
      totalLoad: roundLoad(exerciseLoad({ sets })),
      setCount: sets.length,
    });
  }

  const limit = options?.limit ?? 12;
  return points.slice(-limit);
}

/** Delta of top weight vs previous point in the timeline. */
export function topWeightDeltaKg(points: readonly ExerciseHistoryPoint[]): number | null {
  if (points.length < 2) return null;
  const prev = points[points.length - 2]!;
  const cur = points[points.length - 1]!;
  return Math.round((cur.topWeightKg - prev.topWeightKg) * 10) / 10;
}
