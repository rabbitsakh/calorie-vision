/** Offline queue for workout set POSTs (parity with meal/water/weight drafts). */

export const WORKOUT_SET_DRAFT_QUEUE_KEY = "cv-workout-set-draft-queue-v1";

export type WorkoutSetDraftItem = {
  id: string;
  kind: "failed-workout-set";
  createdAt: string;
  sessionId: string;
  exerciseId: string;
  /** POST body for `/api/workouts/exercises/:id/sets`. */
  body: Record<string, unknown>;
};

type Listener = () => void;

const listeners = new Set<Listener>();

export function subscribeWorkoutSetDraftQueue(listener: Listener): () => void {
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

function readQueue(): WorkoutSetDraftItem[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(WORKOUT_SET_DRAFT_QUEUE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (item): item is WorkoutSetDraftItem =>
        item != null &&
        typeof item === "object" &&
        typeof (item as WorkoutSetDraftItem).id === "string" &&
        (item as WorkoutSetDraftItem).kind === "failed-workout-set" &&
        typeof (item as WorkoutSetDraftItem).sessionId === "string" &&
        typeof (item as WorkoutSetDraftItem).exerciseId === "string" &&
        (item as WorkoutSetDraftItem).body != null &&
        typeof (item as WorkoutSetDraftItem).body === "object",
    );
  } catch {
    return [];
  }
}

function writeQueue(items: WorkoutSetDraftItem[]): void {
  if (typeof window === "undefined") return;
  try {
    if (items.length === 0) {
      localStorage.removeItem(WORKOUT_SET_DRAFT_QUEUE_KEY);
    } else {
      localStorage.setItem(WORKOUT_SET_DRAFT_QUEUE_KEY, JSON.stringify(items.slice(-40)));
    }
    notify();
  } catch {
    // quota / private mode
  }
}

export function listWorkoutSetDrafts(): WorkoutSetDraftItem[] {
  return readQueue();
}

export function countWorkoutSetDrafts(): number {
  return readQueue().length;
}

export function enqueueWorkoutSetDraft(input: {
  sessionId: string;
  exerciseId: string;
  body: Record<string, unknown>;
}): string {
  const id =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `wset-${Date.now()}`;
  const items = readQueue();
  items.push({
    id,
    kind: "failed-workout-set",
    createdAt: new Date().toISOString(),
    sessionId: input.sessionId,
    exerciseId: input.exerciseId,
    body: input.body,
  });
  writeQueue(items);
  return id;
}

export function removeWorkoutSetDraft(id: string): void {
  writeQueue(readQueue().filter((item) => item.id !== id));
}
