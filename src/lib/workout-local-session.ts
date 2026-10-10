/**
 * Offline blank workout sessions created on-device (Wave: offline start).
 * Flushed as POST /api/workouts → POST …/exercises, then set/finish drafts remap.
 */

import { muscleGroupLabel, type MuscleGroupKey } from "@/lib/workouts/muscle-groups";
import type { ExerciseKind } from "@/lib/workouts/exercise-kind";
import { DEFAULT_PROGRESS_RATE } from "@/lib/workouts/load";

export const WORKOUT_LOCAL_SESSION_KEY = "cv-workout-local-session-v1";

export type LocalWorkoutExercise = {
  id: string;
  name: string;
  kind: ExerciseKind;
};

export type LocalWorkoutSession = {
  id: string;
  createdAt: string;
  date: string;
  muscleKeys: MuscleGroupKey[];
  progressRate: number;
  note: string | null;
  exercises: LocalWorkoutExercise[];
  clockStatus: "idle" | "running" | "paused" | "finished";
  startedAt: string | null;
  endedAt: string | null;
  pausedAt: string | null;
  pausedMs: number;
};

type Listener = () => void;
const listeners = new Set<Listener>();

export function subscribeLocalWorkoutSessions(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function notify(): void {
  for (const listener of listeners) {
    try {
      listener();
    } catch {
      // ignore
    }
  }
}

function newId(prefix: string): string {
  const raw =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  return `${prefix}${raw}`;
}

export function isLocalWorkoutId(id: string): boolean {
  return id.startsWith("local-sess-") || id.startsWith("local-ex-");
}

export function isLocalSessionId(id: string): boolean {
  return id.startsWith("local-sess-");
}

function readAll(): LocalWorkoutSession[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(WORKOUT_LOCAL_SESSION_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (item): item is LocalWorkoutSession =>
        item != null &&
        typeof item === "object" &&
        typeof (item as LocalWorkoutSession).id === "string" &&
        isLocalSessionId((item as LocalWorkoutSession).id) &&
        typeof (item as LocalWorkoutSession).date === "string" &&
        Array.isArray((item as LocalWorkoutSession).muscleKeys) &&
        Array.isArray((item as LocalWorkoutSession).exercises),
    );
  } catch {
    return [];
  }
}

function writeAll(items: LocalWorkoutSession[]): void {
  if (typeof window === "undefined") return;
  try {
    if (items.length === 0) {
      localStorage.removeItem(WORKOUT_LOCAL_SESSION_KEY);
    } else {
      localStorage.setItem(WORKOUT_LOCAL_SESSION_KEY, JSON.stringify(items.slice(-8)));
    }
    notify();
  } catch {
    // quota
  }
}

export function listLocalWorkoutSessions(): LocalWorkoutSession[] {
  return readAll().sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export function countLocalWorkoutSessions(): number {
  return readAll().length;
}

export function getLocalWorkoutSession(id: string): LocalWorkoutSession | null {
  return readAll().find((s) => s.id === id) ?? null;
}

export function createLocalWorkoutSession(input: {
  date: string;
  muscleKeys: MuscleGroupKey[];
  progressRate?: number;
  note?: string | null;
}): LocalWorkoutSession {
  const session: LocalWorkoutSession = {
    id: newId("local-sess-"),
    createdAt: new Date().toISOString(),
    date: input.date,
    muscleKeys: input.muscleKeys,
    progressRate:
      typeof input.progressRate === "number" && Number.isFinite(input.progressRate)
        ? input.progressRate
        : DEFAULT_PROGRESS_RATE,
    note: input.note?.trim() ? input.note.trim().slice(0, 200) : null,
    exercises: [],
    clockStatus: "running",
    startedAt: new Date().toISOString(),
    endedAt: null,
    pausedAt: null,
    pausedMs: 0,
  };
  const items = readAll();
  items.push(session);
  writeAll(items);
  return session;
}

export function updateLocalWorkoutSession(
  id: string,
  patch: Partial<
    Pick<
      LocalWorkoutSession,
      | "exercises"
      | "clockStatus"
      | "startedAt"
      | "endedAt"
      | "pausedAt"
      | "pausedMs"
      | "note"
    >
  >,
): LocalWorkoutSession | null {
  const items = readAll();
  const idx = items.findIndex((s) => s.id === id);
  if (idx < 0) return null;
  const next = { ...items[idx]!, ...patch };
  items[idx] = next;
  writeAll(items);
  return next;
}

export function addLocalWorkoutExercise(
  sessionId: string,
  input: { name: string; kind: ExerciseKind },
): LocalWorkoutSession | null {
  const session = getLocalWorkoutSession(sessionId);
  if (!session) return null;
  const name = input.name.trim().slice(0, 120);
  if (!name) return null;
  const ex: LocalWorkoutExercise = {
    id: newId("local-ex-"),
    name,
    kind: input.kind,
  };
  return updateLocalWorkoutSession(sessionId, {
    exercises: [...session.exercises, ex],
  });
}

export function removeLocalWorkoutSession(id: string): void {
  writeAll(readAll().filter((s) => s.id !== id));
}

/** Minimal SessionDetail-shaped object for ActiveSession UI. */
export function localSessionToDetail(session: LocalWorkoutSession) {
  const cardioOnly =
    session.muscleKeys.length === 1 && session.muscleKeys[0] === "cardio";
  return {
    id: session.id,
    date: session.date,
    note: session.note,
    progressRate: session.progressRate,
    muscleKeys: session.muscleKeys,
    muscleLabels: session.muscleKeys.map(muscleGroupLabel),
    exerciseCount: session.exercises.length,
    setCount: 0,
    totalLoad: 0,
    loadByGroup: {} as Record<string, number>,
    cardioDistanceKm: 0,
    cardioDurationSec: 0,
    cardioBestPaceSecPerKm: null as number | null,
    cardioOnly,
    startedAt: session.startedAt,
    endedAt: session.endedAt,
    pausedAt: session.pausedAt,
    pausedMs: session.pausedMs,
    elapsedSec: 0,
    elapsedLabel: "0:00",
    clockStatus: session.clockStatus,
    createdAt: session.createdAt,
    updatedAt: session.createdAt,
    exercises: session.exercises.map((ex) => ({
      id: ex.id,
      name: ex.name,
      kind: ex.kind,
      note: null as string | null,
      muscleGroup: null as string | null,
      muscleLabel: null as string | null,
      load: 0,
      cardioDistanceKm: 0,
      cardioDurationSec: 0,
      cardioBestPaceSecPerKm: null as number | null,
      sortOrder: 0,
      sets: [] as Array<{
        id: string;
        weightKg: number | null;
        reps: number | null;
        distanceKm: number | null;
        durationSec: number | null;
        setType: "working";
        completed: boolean;
        rpe: number | null;
        paceSecPerKm: number | null;
        load: number;
        pendingLocal?: boolean;
      }>,
      lastTime: null,
    })),
  };
}

export function localSessionToSummary(session: LocalWorkoutSession) {
  const detail = localSessionToDetail(session);
  return {
    id: detail.id,
    date: detail.date,
    note: detail.note,
    progressRate: detail.progressRate,
    muscleKeys: detail.muscleKeys,
    muscleLabels: detail.muscleLabels,
    exerciseCount: detail.exerciseCount,
    setCount: detail.setCount,
    totalLoad: detail.totalLoad,
    loadByGroup: detail.loadByGroup,
    cardioDistanceKm: detail.cardioDistanceKm,
    cardioDurationSec: detail.cardioDurationSec,
    cardioBestPaceSecPerKm: detail.cardioBestPaceSecPerKm,
    cardioOnly: detail.cardioOnly,
    startedAt: detail.startedAt,
    endedAt: detail.endedAt,
    pausedAt: detail.pausedAt,
    pausedMs: detail.pausedMs,
    elapsedSec: detail.elapsedSec,
    elapsedLabel: detail.elapsedLabel,
    clockStatus: detail.clockStatus,
    createdAt: detail.createdAt,
    updatedAt: detail.updatedAt,
  };
}
