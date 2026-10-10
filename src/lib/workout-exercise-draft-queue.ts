/**
 * Offline queue for POST /api/workouts/:sessionId/exercises (Wave P).
 * Local-ex ids are remapped after flush so set drafts can attach.
 */

import { parseExerciseKind, type ExerciseKind } from "@/lib/workouts/exercise-kind";

export const WORKOUT_EXERCISE_DRAFT_QUEUE_KEY = "cv-workout-exercise-draft-queue-v1";

export type WorkoutExerciseDraftItem = {
  id: string;
  kind: "failed-workout-exercise";
  createdAt: string;
  sessionId: string;
  name: string;
  exerciseKind: ExerciseKind;
};

type Listener = () => void;
const listeners = new Set<Listener>();

export function subscribeWorkoutExerciseDraftQueue(listener: Listener): () => void {
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

function newLocalExId(): string {
  const raw =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  return `local-ex-${raw}`;
}

function readQueue(): WorkoutExerciseDraftItem[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(WORKOUT_EXERCISE_DRAFT_QUEUE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((item): item is WorkoutExerciseDraftItem => {
      if (item == null || typeof item !== "object") return false;
      const row = item as WorkoutExerciseDraftItem;
      return (
        row.kind === "failed-workout-exercise" &&
        typeof row.id === "string" &&
        row.id.startsWith("local-ex-") &&
        typeof row.sessionId === "string" &&
        typeof row.name === "string" &&
        row.name.trim().length > 0
      );
    });
  } catch {
    return [];
  }
}

function writeQueue(items: WorkoutExerciseDraftItem[]): void {
  if (typeof window === "undefined") return;
  try {
    if (items.length === 0) {
      localStorage.removeItem(WORKOUT_EXERCISE_DRAFT_QUEUE_KEY);
    } else {
      localStorage.setItem(WORKOUT_EXERCISE_DRAFT_QUEUE_KEY, JSON.stringify(items.slice(-40)));
    }
    notify();
  } catch {
    // quota
  }
}

export function listWorkoutExerciseDrafts(): WorkoutExerciseDraftItem[] {
  return readQueue();
}

export function listWorkoutExerciseDraftsForSession(
  sessionId: string,
): WorkoutExerciseDraftItem[] {
  return readQueue().filter((item) => item.sessionId === sessionId);
}

export function countWorkoutExerciseDrafts(): number {
  return readQueue().length;
}

export function enqueueWorkoutExerciseDraft(input: {
  sessionId: string;
  name: string;
  exerciseKind: ExerciseKind | string;
}): string {
  const name = input.name.trim().slice(0, 120);
  if (!name) return "";
  const id = newLocalExId();
  const items = readQueue();
  items.push({
    id,
    kind: "failed-workout-exercise",
    createdAt: new Date().toISOString(),
    sessionId: input.sessionId,
    name,
    exerciseKind: parseExerciseKind(input.exerciseKind, "strength"),
  });
  writeQueue(items);
  return id;
}

export function removeWorkoutExerciseDraft(id: string): void {
  writeQueue(readQueue().filter((item) => item.id !== id));
}

/** Remap session ids after a local session sync (exercises stay local-ex until flushed). */
export function remapWorkoutExerciseDraftSessionIds(
  sessionIdMap: Record<string, string>,
): void {
  if (Object.keys(sessionIdMap).length === 0) return;
  writeQueue(
    readQueue().map((item) => ({
      ...item,
      sessionId: sessionIdMap[item.sessionId] ?? item.sessionId,
    })),
  );
}
