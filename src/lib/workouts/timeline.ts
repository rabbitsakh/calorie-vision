import { cardioSetTotals, paceSecPerKm } from "@/lib/workouts/cardio";
import { exerciseNamesMatch, normalizeExerciseName } from "@/lib/workouts/exercise-name";
import { parseExerciseKind, type ExerciseKind } from "@/lib/workouts/exercise-kind";
import { exerciseLoad, roundLoad } from "@/lib/workouts/load";
import { computeExercisePrs, type PrSet } from "@/lib/workouts/prs";

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
  /** Epley ~1ПМ лучшего рабочего подхода. 0, если вес не учитывается. */
  estimated1Rm: number;
  /** Вес лучшего подхода (макс. кг). */
  bestSetKg: number;
  bestSetReps: number;
  /** Объём одного лучшего подхода, кг × повторы. */
  bestSetVolume: number;
};

type SourceSet = {
  weightKg: number | null;
  reps: number | null;
  distanceKm?: number | null;
  durationSec?: number | null;
  setType?: string | null;
  completed?: boolean | null;
  sortOrder: number;
};
type SourceExercise = {
  id: string;
  name: string;
  kind?: string | null;
  catalogId?: string | null;
  sets: SourceSet[];
};
type SourceSession = {
  id: string;
  date: string;
  createdAt: Date | string;
  exercises: SourceExercise[];
};

function toPrSets(sets: readonly SourceSet[]): PrSet[] {
  return sets.map((set) => ({
    weightKg: set.weightKg,
    reps: set.reps,
    distanceKm: set.distanceKm,
    durationSec: set.durationSec,
    setType: set.setType,
    completed: set.completed,
  }));
}

function chartFromPrs(kind: ExerciseKind, sets: readonly SourceSet[]) {
  const prs = computeExercisePrs(kind, toPrSets(sets));
  if (prs.kind === "strength" || prs.kind === "weighted_bw") {
    return {
      estimated1Rm: prs.estimated1Rm,
      bestSetKg: prs.heaviestKg,
      bestSetReps: prs.heaviestReps,
      bestSetVolume: prs.bestSetVolume,
      topWeightKg: prs.heaviestKg,
      topReps: prs.heaviestReps,
    };
  }
  if (prs.kind === "bodyweight") {
    return {
      estimated1Rm: 0,
      bestSetKg: 0,
      bestSetReps: prs.bestReps,
      bestSetVolume: 0,
      topWeightKg: 0,
      topReps: prs.bestReps,
    };
  }
  if (prs.kind === "assisted") {
    let topWeightKg = 0;
    let topReps = 0;
    for (const set of sets) {
      const weight = Number(set.weightKg);
      const reps = Number(set.reps) || 0;
      if (Number.isFinite(weight) && weight > topWeightKg) {
        topWeightKg = weight;
        topReps = reps;
      }
    }
    return {
      estimated1Rm: 0,
      bestSetKg: prs.lightestAssistKg ?? 0,
      bestSetReps: prs.bestReps,
      bestSetVolume: 0,
      topWeightKg,
      topReps,
    };
  }
  return {
    estimated1Rm: 0,
    bestSetKg: 0,
    bestSetReps: 0,
    bestSetVolume: 0,
    topWeightKg: 0,
    topReps: 0,
  };
}

function exercisesForPoint(
  session: SourceSession,
  nameKey: string,
  catalogId: string | null,
): SourceExercise[] {
  if (catalogId) {
    return session.exercises.filter((exercise) => exercise.catalogId === catalogId);
  }
  const match = session.exercises.find((exercise) => exerciseNamesMatch(exercise.name, nameKey));
  return match ? [match] : [];
}

/**
 * Хронология одного движения, от старых к новым.
 * Если передан catalogId, в одну линию попадают все записи с этим id,
 * даже когда названия в зале отличались.
 */
export function buildExerciseTimeline(
  sessions: readonly SourceSession[],
  exerciseName: string,
  options?: { limit?: number; catalogId?: string | null },
): ExerciseHistoryPoint[] {
  const catalogId = options?.catalogId?.trim() || null;
  const key = normalizeExerciseName(exerciseName);
  if (!catalogId && !key) return [];

  const points: ExerciseHistoryPoint[] = [];
  const sorted = sessions.slice().sort((a, b) => {
    const d = a.date.localeCompare(b.date);
    if (d !== 0) return d;
    const ta = a.createdAt instanceof Date ? a.createdAt.getTime() : new Date(a.createdAt).getTime();
    const tb = b.createdAt instanceof Date ? b.createdAt.getTime() : new Date(b.createdAt).getTime();
    return ta - tb;
  });

  for (const session of sorted) {
    const matches = exercisesForPoint(session, key, catalogId).filter((exercise) => exercise.sets.length > 0);
    if (matches.length === 0) continue;

    const kind = parseExerciseKind(matches[0]!.kind);
    const sets = matches.flatMap((exercise) =>
      [...exercise.sets].sort((a, b) => a.sortOrder - b.sortOrder),
    );
    const chart = chartFromPrs(kind, sets);

    if (kind === "cardio") {
      const totals = cardioSetTotals(sets);
      points.push({
        date: session.date,
        sessionId: session.id,
        exerciseId: matches[0]!.id,
        kind,
        topWeightKg: 0,
        topReps: 0,
        totalLoad: 0,
        setCount: sets.length,
        distanceKm: totals.distanceKm,
        durationSec: totals.durationSec,
        bestPaceSecPerKm: totals.bestPaceSecPerKm,
        estimated1Rm: 0,
        bestSetKg: 0,
        bestSetReps: 0,
        bestSetVolume: 0,
      });
      continue;
    }

    if (kind === "duration") {
      let maxDur = 0;
      for (const set of sets) {
        const duration = Number(set.durationSec);
        if (Number.isFinite(duration) && duration > maxDur) maxDur = duration;
      }
      points.push({
        date: session.date,
        sessionId: session.id,
        exerciseId: matches[0]!.id,
        kind,
        topWeightKg: 0,
        topReps: 0,
        totalLoad: 0,
        setCount: sets.length,
        distanceKm: 0,
        durationSec: maxDur,
        bestPaceSecPerKm: null,
        estimated1Rm: 0,
        bestSetKg: 0,
        bestSetReps: 0,
        bestSetVolume: 0,
      });
      continue;
    }

    points.push({
      date: session.date,
      sessionId: session.id,
      exerciseId: matches[0]!.id,
      kind,
      topWeightKg: chart.topWeightKg,
      topReps: chart.topReps,
      totalLoad: roundLoad(
        exerciseLoad({
          kind,
          sets: sets.map((set) => ({
            weightKg: set.weightKg,
            reps: set.reps,
            setType: set.setType,
            completed: set.completed,
          })),
        }),
      ),
      setCount: sets.length,
      distanceKm: 0,
      durationSec: 0,
      bestPaceSecPerKm: null,
      estimated1Rm: chart.estimated1Rm,
      bestSetKg: chart.bestSetKg,
      bestSetReps: chart.bestSetReps,
      bestSetVolume: chart.bestSetVolume,
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
