import {
  exerciseLoad,
  loadByMuscleGroup,
  roundLoad,
  sessionTotalLoad,
  type LoadExercise,
} from "@/lib/workouts/load";
import { muscleGroupLabel, normalizeGroupKeys } from "@/lib/workouts/muscle-groups";

export type DbSet = {
  id: string;
  weightKg: number;
  reps: number;
  sortOrder: number;
};

export type DbExercise = {
  id: string;
  name: string;
  muscleGroup: string | null;
  sortOrder: number;
  sets: DbSet[];
};

export type DbSession = {
  id: string;
  date: string;
  note: string | null;
  progressRate: number;
  createdAt: Date;
  updatedAt: Date;
  muscles: Array<{ groupKey: string }>;
  exercises: DbExercise[];
};

function toLoadExercises(exercises: DbExercise[]): LoadExercise[] {
  return exercises.map((ex) => ({
    muscleGroup: ex.muscleGroup,
    sets: ex.sets.map((s) => ({ weightKg: s.weightKg, reps: s.reps })),
  }));
}

export function serializeSessionSummary(session: DbSession) {
  const muscleKeys = normalizeGroupKeys(session.muscles.map((m) => m.groupKey));
  const loadExercises = toLoadExercises(session.exercises);
  const totalLoad = roundLoad(sessionTotalLoad(loadExercises));
  const byGroup = loadByMuscleGroup(loadExercises, muscleKeys);
  const loadByGroup: Record<string, number> = {};
  for (const [k, v] of Object.entries(byGroup)) {
    loadByGroup[k] = roundLoad(v);
  }

  return {
    id: session.id,
    date: session.date,
    note: session.note,
    progressRate: session.progressRate,
    muscleKeys,
    muscleLabels: muscleKeys.map(muscleGroupLabel),
    exerciseCount: session.exercises.length,
    setCount: session.exercises.reduce((n, ex) => n + ex.sets.length, 0),
    totalLoad,
    loadByGroup,
    createdAt: session.createdAt.toISOString(),
    updatedAt: session.updatedAt.toISOString(),
  };
}

export function serializeSessionDetail(session: DbSession) {
  const summary = serializeSessionSummary(session);
  const exercises = [...session.exercises]
    .sort((a, b) => a.sortOrder - b.sortOrder || a.id.localeCompare(b.id))
    .map((ex) => {
      const sets = [...ex.sets]
        .sort((a, b) => a.sortOrder - b.sortOrder || a.id.localeCompare(b.id))
        .map((s) => ({
          id: s.id,
          weightKg: s.weightKg,
          reps: s.reps,
          sortOrder: s.sortOrder,
          load: roundLoad(s.weightKg * s.reps),
        }));
      return {
        id: ex.id,
        name: ex.name,
        muscleGroup: ex.muscleGroup,
        muscleLabel: ex.muscleGroup ? muscleGroupLabel(ex.muscleGroup) : null,
        sortOrder: ex.sortOrder,
        load: roundLoad(exerciseLoad({ muscleGroup: ex.muscleGroup, sets })),
        sets,
      };
    });

  return { ...summary, exercises };
}

export const sessionInclude = {
  muscles: true,
  exercises: {
    include: { sets: true },
  },
} as const;
