import { prisma } from "@/lib/prisma";
import type { DiaryExportEntry } from "@/lib/export/diary";
import type { WeightExportEntry } from "@/lib/export/weight";
import {
  resolveWorkoutExportTimezone,
  workoutExportDateWhere,
  type WorkoutExportSession,
} from "@/lib/workouts/export-csv";

function dateWhere(from: string | null, to: string | null) {
  const date = workoutExportDateWhere(from, to);
  return date ? { date } : {};
}

export async function loadUserExportTimezone(userId: string): Promise<string> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { timezone: true },
  });
  return resolveWorkoutExportTimezone(user?.timezone);
}

export async function loadDiaryEntries(
  userId: string,
  from: string | null,
  to: string | null,
): Promise<DiaryExportEntry[]> {
  const rows = await prisma.mealEntry.findMany({
    where: { userId, ...dateWhere(from, to) },
    orderBy: [{ date: "asc" }, { createdAt: "asc" }],
    select: {
      date: true,
      createdAt: true,
      eatenAt: true,
      dishName: true,
      mealType: true,
      calories: true,
      protein: true,
      fat: true,
      carbs: true,
      fiber: true,
      sugar: true,
      portionGrams: true,
      wasCorrected: true,
    },
  });
  return rows.map((row) => ({
    date: row.date,
    createdAt: row.createdAt,
    eatenAt: row.eatenAt,
    dishName: row.dishName,
    mealType: row.mealType,
    calories: row.calories,
    protein: row.protein,
    fat: row.fat,
    carbs: row.carbs,
    fiber: row.fiber,
    sugar: row.sugar,
    portionGrams: row.portionGrams,
    wasCorrected: row.wasCorrected,
  }));
}

type StoredWorkout = {
  date: string;
  note: string | null;
  startedAt: Date | null;
  endedAt: Date | null;
  muscles: { groupKey: string }[];
  exercises: {
    name: string;
    kind: string | null;
    note: string | null;
    sortOrder: number;
    sets: {
      weightKg: number | null;
      reps: number | null;
      distanceKm: number | null;
      durationSec: number | null;
      setType: string | null;
      completed: boolean | null;
      rpe: number | null;
      sortOrder: number;
    }[];
  }[];
};

export function mapWorkoutExportSession(row: StoredWorkout): WorkoutExportSession {
  return {
    date: row.date,
    note: row.note,
    startedAt: row.startedAt,
    endedAt: row.endedAt,
    muscles: row.muscles.map((muscle) => muscle.groupKey),
    exercises: row.exercises.map((exercise) => ({
      name: exercise.name,
      kind: exercise.kind,
      note: exercise.note,
      sortOrder: exercise.sortOrder,
      sets: exercise.sets.map((set) => ({
        weightKg: set.weightKg,
        reps: set.reps,
        distanceKm: set.distanceKm,
        durationSec: set.durationSec,
        setType: set.setType,
        completed: set.completed,
        rpe: set.rpe,
        sortOrder: set.sortOrder,
      })),
    })),
  };
}

export async function loadWorkoutSessions(
  userId: string,
  from: string | null,
  to: string | null,
): Promise<WorkoutExportSession[]> {
  const rows = await prisma.workoutSession.findMany({
    where: { userId, ...dateWhere(from, to) },
    orderBy: [{ date: "asc" }, { startedAt: "asc" }, { createdAt: "asc" }],
    include: {
      muscles: true,
      exercises: { include: { sets: true } },
    },
  });
  return rows.map((row) => mapWorkoutExportSession(row));
}

export async function loadWeightEntries(
  userId: string,
  from: string | null,
  to: string | null,
): Promise<WeightExportEntry[]> {
  const rows = await prisma.weightEntry.findMany({
    where: { userId, ...dateWhere(from, to) },
    orderBy: [{ date: "asc" }, { measuredAt: "asc" }],
    select: {
      date: true,
      weightKg: true,
      note: true,
      measuredAt: true,
    },
  });
  return rows.map((row) => ({
    date: row.date,
    weightKg: row.weightKg,
    note: row.note,
    measuredAt: row.measuredAt,
  }));
}
