/**
 * Merge offline workout-set drafts into a session for display / Wave L targets.
 */

import { setLoad, sessionTotalLoad } from "@/lib/workouts/load";
import { parseSetType, type SetType } from "@/lib/workouts/set-meta";
import type { WorkoutSetDraftItem } from "@/lib/workout-set-draft-queue";

export type PendingSetRow = {
  id: string;
  weightKg: number | null;
  reps: number | null;
  distanceKm: number | null;
  durationSec: number | null;
  setType: SetType;
  completed: boolean;
  rpe: number | null;
  paceSecPerKm: number | null;
  load: number;
  pendingLocal: true;
};

function numOrNull(raw: unknown): number | null {
  if (typeof raw === "number" && Number.isFinite(raw)) return raw;
  if (typeof raw === "string" && raw.trim()) {
    const n = Number(raw.replace(",", "."));
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

export function localDraftSetId(draftId: string): string {
  return `local-${draftId}`;
}

export function draftIdFromLocalSetId(setId: string): string | null {
  return setId.startsWith("local-") ? setId.slice("local-".length) : null;
}

export function draftBodyToPendingSet(
  draftId: string,
  body: Record<string, unknown>,
): PendingSetRow {
  const weightKg = numOrNull(body.weightKg);
  const reps = numOrNull(body.reps);
  const distanceKm = numOrNull(body.distanceKm);
  const durationSec = numOrNull(body.durationSec);
  const rpe = numOrNull(body.rpe);
  const setType = parseSetType(body.setType);
  const completed = body.completed !== false && body.completed !== 0;
  const load = setLoad({ weightKg, reps, setType, completed });
  return {
    id: localDraftSetId(draftId),
    weightKg,
    reps,
    distanceKm,
    durationSec,
    setType,
    completed,
    rpe,
    paceSecPerKm: null,
    load,
    pendingLocal: true,
  };
}

type MergeSet = {
  id: string;
  weightKg: number | null;
  reps: number | null;
  distanceKm: number | null;
  durationSec: number | null;
  setType: SetType;
  completed: boolean;
  rpe: number | null;
  paceSecPerKm: number | null;
  load: number;
  pendingLocal?: boolean;
};

type MergeExercise = {
  id: string;
  kind: string;
  load: number;
  cardioDistanceKm: number;
  cardioDurationSec: number;
  sets: MergeSet[];
};

type MergeSession = {
  id: string;
  totalLoad: number;
  setCount: number;
  cardioDistanceKm: number;
  cardioDurationSec: number;
  exercises: MergeExercise[];
};

/**
 * Append queued set drafts for this session onto matching exercises.
 * Recomputes exercise/session load and cardio totals.
 */
export function mergeQueuedSetsIntoSession<T extends MergeSession>(
  session: T,
  drafts: readonly WorkoutSetDraftItem[],
): T {
  const relevant = drafts.filter((d) => d.sessionId === session.id);
  if (relevant.length === 0) return session;

  const byExercise = new Map<string, WorkoutSetDraftItem[]>();
  for (const d of relevant) {
    const list = byExercise.get(d.exerciseId) ?? [];
    list.push(d);
    byExercise.set(d.exerciseId, list);
  }

  const exercises = session.exercises.map((ex) => {
    const extras = byExercise.get(ex.id);
    if (!extras?.length) return ex;
    const pending = extras.map((d) => draftBodyToPendingSet(d.id, d.body));
    const sets = [...ex.sets, ...pending];
    const load = sessionTotalLoad([{ kind: ex.kind, sets }]);
    let cardioDistanceKm = 0;
    let cardioDurationSec = 0;
    if (ex.kind === "cardio") {
      for (const s of sets) {
        cardioDistanceKm += s.distanceKm ?? 0;
        cardioDurationSec += s.durationSec ?? 0;
      }
      cardioDistanceKm = Math.round(cardioDistanceKm * 1000) / 1000;
    }
    return {
      ...ex,
      sets,
      load,
      cardioDistanceKm: ex.kind === "cardio" ? cardioDistanceKm : ex.cardioDistanceKm,
      cardioDurationSec: ex.kind === "cardio" ? cardioDurationSec : ex.cardioDurationSec,
    };
  });

  const totalLoad = sessionTotalLoad(exercises);
  const setCount = exercises.reduce((n, e) => n + e.sets.length, 0);
  const cardioDistanceKm = exercises.reduce((n, e) => n + (e.cardioDistanceKm ?? 0), 0);
  const cardioDurationSec = exercises.reduce((n, e) => n + (e.cardioDurationSec ?? 0), 0);

  return {
    ...session,
    exercises,
    totalLoad,
    setCount,
    cardioDistanceKm: Math.round(cardioDistanceKm * 1000) / 1000,
    cardioDurationSec,
  };
}
