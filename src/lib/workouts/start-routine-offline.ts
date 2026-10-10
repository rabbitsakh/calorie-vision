/**
 * Start a cached routine as a local offline session + planned set drafts (Wave Q).
 */

import { enqueueWorkoutSetDraft } from "@/lib/workout-set-draft-queue";
import {
  addLocalWorkoutExercise,
  createLocalWorkoutSession,
} from "@/lib/workout-local-session";
import { isMuscleGroupKey, type MuscleGroupKey } from "@/lib/workouts/muscle-groups";
import type { SerializedRoutine } from "@/lib/workouts/routines";

export function startRoutineOffline(input: {
  routine: SerializedRoutine;
  date: string;
  progressRate?: number;
}): { sessionId: string } | null {
  const muscleKeys = input.routine.muscleKeys.filter(isMuscleGroupKey) as MuscleGroupKey[];
  if (muscleKeys.length === 0) return null;
  if (input.routine.exercises.length === 0) return null;

  let session = createLocalWorkoutSession({
    date: input.date,
    muscleKeys,
    progressRate: input.progressRate,
    note: input.routine.note ?? input.routine.name,
  });

  for (const ex of input.routine.exercises) {
    const next = addLocalWorkoutExercise(session.id, {
      name: ex.name,
      kind: ex.kind,
    });
    if (!next) continue;
    session = next;
    const created = next.exercises.at(-1);
    if (!created) continue;
    for (const ps of ex.plannedSets) {
      enqueueWorkoutSetDraft({
        sessionId: next.id,
        exerciseId: created.id,
        body: {
          weightKg: ps.weightKg,
          reps: ps.reps,
          distanceKm: ps.distanceKm,
          durationSec: ps.durationSec,
          setType: ps.setType,
          completed: false,
        },
      });
    }
  }

  return { sessionId: session.id };
}
