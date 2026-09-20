import { cardioSetTotals, paceSecPerKm } from "@/lib/workouts/cardio";
import { normalizeExerciseName } from "@/lib/workouts/exercise-name";
import { parseExerciseKind, type ExerciseKind } from "@/lib/workouts/exercise-kind";
import { exerciseLoad, roundLoad } from "@/lib/workouts/load";

export type ExerciseHistoryPoint = {
  date: string;
  sessionId: string;
  exerciseId: string;
  kind: ExerciseKind;
  /** Best (max) weight that day (strength / weighted / assisted). */
  topWeightKg: number;
  /** Reps at the top-weight set, or max reps for bodyweight. */
  topReps: number;
  totalLoad: number;
  setCount: number;
  /** Cardio / duration totals for the day. */
  distanceKm: number;
  durationSec: number;
  bestPaceSecPerKm: number | null;
};

type SourceSet = {
  weightKg: number | null;
  reps: number | null;
  distanceKm?: number | null;
  durationSec?: number | null;
  sortOrder: number;
};
type SourceExercise = { id: string; name: string; kind?: string | null; sets: SourceSet[] };
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

    const kind = parseExerciseKind(match.kind);
    const sets = [...match.sets].sort((a, b) => a.sortOrder - b.sortOrder);

    if (kind === "cardio") {
      const totals = cardioSetTotals(sets);
      points.push({
        date: session.date,
        sessionId: session.id,
        exerciseId: match.id,
        kind,
        topWeightKg: 0,
        topReps: 0,
        totalLoad: 0,
        setCount: sets.length,
        distanceKm: totals.distanceKm,
        durationSec: totals.durationSec,
        bestPaceSecPerKm: totals.bestPaceSecPerKm,
      });
      continue;
    }

    if (kind === "duration") {
      let maxDur = 0;
      for (const s of sets) {
        const d = Number(s.durationSec);
        if (Number.isFinite(d) && d > maxDur) maxDur = d;
      }
      points.push({
        date: session.date,
        sessionId: session.id,
        exerciseId: match.id,
        kind,
        topWeightKg: 0,
        topReps: 0,
        totalLoad: 0,
        setCount: sets.length,
        distanceKm: 0,
        durationSec: maxDur,
        bestPaceSecPerKm: null,
      });
      continue;
    }

    if (kind === "bodyweight") {
      let topReps = 0;
      for (const s of sets) {
        const r = Number(s.reps);
        if (Number.isFinite(r) && r > topReps) topReps = r;
      }
      points.push({
        date: session.date,
        sessionId: session.id,
        exerciseId: match.id,
        kind,
        topWeightKg: 0,
        topReps,
        totalLoad: 0,
        setCount: sets.length,
        distanceKm: 0,
        durationSec: 0,
        bestPaceSecPerKm: null,
      });
      continue;
    }

    // strength | weighted_bw | assisted — track top weight
    let top = sets[0]!;
    for (const s of sets) {
      const w = Number(s.weightKg);
      const topW = Number(top.weightKg);
      if (Number.isFinite(w) && (!Number.isFinite(topW) || w > topW)) top = s;
    }
    points.push({
      date: session.date,
      sessionId: session.id,
      exerciseId: match.id,
      kind,
      topWeightKg: Number(top.weightKg) || 0,
      topReps: Number(top.reps) || 0,
      totalLoad: roundLoad(
        exerciseLoad({
          kind,
          sets: sets.map((s) => ({ weightKg: s.weightKg, reps: s.reps })),
        }),
      ),
      setCount: sets.length,
      distanceKm: 0,
      durationSec: 0,
      bestPaceSecPerKm: null,
    });
  }

  const limit = options?.limit ?? 12;
  return points.slice(-limit);
}

/** Delta of top weight vs previous point (strength + weighted_bw). */
export function topWeightDeltaKg(points: readonly ExerciseHistoryPoint[]): number | null {
  const strength = points.filter(
    (p) => p.kind === "strength" || p.kind === "weighted_bw",
  );
  if (strength.length < 2) return null;
  const prev = strength[strength.length - 2]!;
  const cur = strength[strength.length - 1]!;
  return Math.round((cur.topWeightKg - prev.topWeightKg) * 10) / 10;
}

/** Delta of best pace (sec/km); negative = faster. */
export function bestPaceDeltaSec(points: readonly ExerciseHistoryPoint[]): number | null {
  const cardio = points.filter((p) => p.kind === "cardio" && p.bestPaceSecPerKm != null);
  if (cardio.length < 2) return null;
  const prev = cardio[cardio.length - 2]!;
  const cur = cardio[cardio.length - 1]!;
  return Math.round((cur.bestPaceSecPerKm! - prev.bestPaceSecPerKm!) * 10) / 10;
}

export { paceSecPerKm };
