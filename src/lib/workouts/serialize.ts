import {
  cardioSetTotals,
  formatDistanceKm,
  formatDurationMinutes,
  formatPace,
  paceSecPerKm,
} from "@/lib/workouts/cardio";
import { parseExerciseKind, fieldsForKind, type ExerciseKind } from "@/lib/workouts/exercise-kind";
import { parseBlockMode } from "@/lib/workouts/block-mode";
import {
  exerciseLoad,
  loadByMuscleGroup,
  roundLoad,
  sessionTotalLoad,
  type LoadExercise,
} from "@/lib/workouts/load";
import { muscleGroupLabel, normalizeGroupKeys } from "@/lib/workouts/muscle-groups";
import { parseSetType, type SetType } from "@/lib/workouts/set-meta";
import {
  formatSessionClock,
  sessionClockStatus,
  sessionElapsedSec,
} from "@/lib/workouts/session-clock";

export type DbSet = {
  id: string;
  weightKg: number | null;
  reps: number | null;
  distanceKm?: number | null;
  durationSec?: number | null;
  setType?: string | null;
  completed?: boolean | null;
  rpe?: number | null;
  sortOrder: number;
};

export type DbExercise = {
  id: string;
  name: string;
  kind?: string | null;
  muscleGroup: string | null;
  note?: string | null;
  sortOrder: number;
  supersetGroup?: string | null;
  blockMode?: string | null;
  circuitRounds?: number | null;
  sets: DbSet[];
};

export type DbSession = {
  id: string;
  date: string;
  note: string | null;
  progressRate: number;
  startedAt?: Date | null;
  endedAt?: Date | null;
  pausedAt?: Date | null;
  pausedMs?: number | null;
  createdAt: Date;
  updatedAt: Date;
  muscles: Array<{ groupKey: string }>;
  exercises: DbExercise[];
};

function toLoadExercises(exercises: DbExercise[]): LoadExercise[] {
  return exercises.map((ex) => ({
    muscleGroup: ex.muscleGroup,
    kind: parseExerciseKind(ex.kind),
    sets: ex.sets.map((s) => ({
      weightKg: s.weightKg,
      reps: s.reps,
      setType: s.setType,
      completed: s.completed,
    })),
  }));
}

function sessionCardioTotals(exercises: DbExercise[]) {
  const cardioSets = exercises
    .filter((ex) => parseExerciseKind(ex.kind) === "cardio")
    .flatMap((ex) => ex.sets.filter((s) => s.completed !== false));
  return cardioSetTotals(cardioSets);
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
  const cardio = sessionCardioTotals(session.exercises);
  const cardioOnly =
    muscleKeys.length === 1 && muscleKeys[0] === "cardio" && totalLoad === 0;
  const clock = {
    startedAt: session.startedAt ?? null,
    endedAt: session.endedAt ?? null,
    pausedAt: session.pausedAt ?? null,
    pausedMs: session.pausedMs ?? 0,
  };
  const elapsedSec = sessionElapsedSec(clock);
  const clockStatus = sessionClockStatus(clock);

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
    cardioDistanceKm: cardio.distanceKm,
    cardioDurationSec: cardio.durationSec,
    cardioBestPaceSecPerKm: cardio.bestPaceSecPerKm,
    cardioOnly,
    startedAt: clock.startedAt ? new Date(clock.startedAt).toISOString() : null,
    endedAt: clock.endedAt ? new Date(clock.endedAt).toISOString() : null,
    pausedAt: clock.pausedAt ? new Date(clock.pausedAt).toISOString() : null,
    pausedMs: clock.pausedMs,
    elapsedSec,
    elapsedLabel: formatSessionClock(elapsedSec),
    clockStatus,
    createdAt: session.createdAt.toISOString(),
    updatedAt: session.updatedAt.toISOString(),
  };
}

export function serializeSessionDetail(session: DbSession) {
  const summary = serializeSessionSummary(session);
  const exercises = [...session.exercises]
    .sort((a, b) => a.sortOrder - b.sortOrder || a.id.localeCompare(b.id))
    .map((ex) => {
      const kind: ExerciseKind = parseExerciseKind(ex.kind);
      const sets = [...ex.sets]
        .sort((a, b) => a.sortOrder - b.sortOrder || a.id.localeCompare(b.id))
        .map((s) => {
          const weightKg = s.weightKg;
          const reps = s.reps;
          const distanceKm = s.distanceKm ?? null;
          const durationSec = s.durationSec ?? null;
          const setType: SetType = parseSetType(s.setType);
          const completed = s.completed !== false;
          const rpe = s.rpe ?? null;
          const load = fieldsForKind(kind).countsTowardLoad
            ? roundLoad(
                exerciseLoad({
                  kind,
                  sets: [{ weightKg, reps, setType, completed }],
                }),
              )
            : 0;
          return {
            id: s.id,
            weightKg,
            reps,
            distanceKm,
            durationSec,
            setType,
            completed,
            rpe,
            paceSecPerKm: paceSecPerKm(distanceKm ?? 0, durationSec ?? 0),
            sortOrder: s.sortOrder,
            load,
          };
        });
      const cardio =
        kind === "cardio" ? cardioSetTotals(sets.filter((s) => s.completed)) : null;
      return {
        id: ex.id,
        name: ex.name,
        kind,
        note: ex.note ?? null,
        muscleGroup: ex.muscleGroup,
        muscleLabel: ex.muscleGroup ? muscleGroupLabel(ex.muscleGroup) : null,
        sortOrder: ex.sortOrder,
        supersetGroup: ex.supersetGroup?.trim() || null,
        blockMode: parseBlockMode(ex.blockMode),
        circuitRounds: ex.circuitRounds ?? null,
        load: roundLoad(
          exerciseLoad({
            muscleGroup: ex.muscleGroup,
            kind,
            sets: sets.map((s) => ({
              weightKg: s.weightKg,
              reps: s.reps,
              setType: s.setType,
              completed: s.completed,
            })),
          }),
        ),
        cardioDistanceKm: cardio?.distanceKm ?? 0,
        cardioDurationSec: cardio?.durationSec ?? 0,
        cardioBestPaceSecPerKm: cardio?.bestPaceSecPerKm ?? null,
        sets,
      };
    });

  return { ...summary, exercises };
}

export function formatCardioSummaryLine(input: {
  distanceKm: number;
  durationSec: number;
  bestPaceSecPerKm?: number | null;
}): string {
  const parts: string[] = [];
  if (input.distanceKm > 0) parts.push(`${formatDistanceKm(input.distanceKm)} км`);
  if (input.durationSec > 0) parts.push(formatDurationMinutes(input.durationSec));
  const pace = formatPace(input.bestPaceSecPerKm);
  if (pace) parts.push(pace);
  return parts.join(" · ") || "—";
}

export const sessionInclude = {
  muscles: true,
  exercises: {
    include: { sets: true },
  },
} as const;
