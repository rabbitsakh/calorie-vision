/** Offline queue for workout set POSTs + finish PATCHes (parity with meal drafts). */

export const WORKOUT_SET_DRAFT_QUEUE_KEY = "cv-workout-set-draft-queue-v1";
export const WORKOUT_FINISH_DRAFT_QUEUE_KEY = "cv-workout-finish-draft-queue-v1";

export type WorkoutSetDraftItem = {
  id: string;
  kind: "failed-workout-set";
  createdAt: string;
  sessionId: string;
  exerciseId: string;
  /** POST body for `/api/workouts/exercises/:id/sets`. */
  body: Record<string, unknown>;
};

export type WorkoutFinishDraftItem = {
  id: string;
  kind: "failed-workout-finish";
  createdAt: string;
  sessionId: string;
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

function readFinishQueue(): WorkoutFinishDraftItem[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(WORKOUT_FINISH_DRAFT_QUEUE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (item): item is WorkoutFinishDraftItem =>
        item != null &&
        typeof item === "object" &&
        typeof (item as WorkoutFinishDraftItem).id === "string" &&
        (item as WorkoutFinishDraftItem).kind === "failed-workout-finish" &&
        typeof (item as WorkoutFinishDraftItem).sessionId === "string",
    );
  } catch {
    return [];
  }
}

function writeFinishQueue(items: WorkoutFinishDraftItem[]): void {
  if (typeof window === "undefined") return;
  try {
    if (items.length === 0) {
      localStorage.removeItem(WORKOUT_FINISH_DRAFT_QUEUE_KEY);
    } else {
      localStorage.setItem(
        WORKOUT_FINISH_DRAFT_QUEUE_KEY,
        JSON.stringify(items.slice(-20)),
      );
    }
    notify();
  } catch {
    // quota / private mode
  }
}

export function listWorkoutSetDrafts(): WorkoutSetDraftItem[] {
  return readQueue();
}

export function listWorkoutSetDraftsForSession(sessionId: string): WorkoutSetDraftItem[] {
  return readQueue().filter((item) => item.sessionId === sessionId);
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

export function getWorkoutSetDraft(id: string): WorkoutSetDraftItem | null {
  return readQueue().find((item) => item.id === id) ?? null;
}

/** Patch queued set body (offline edit before sync). */
export function updateWorkoutSetDraft(
  id: string,
  patch: Record<string, unknown>,
): WorkoutSetDraftItem | null {
  const items = readQueue();
  const idx = items.findIndex((item) => item.id === id);
  if (idx < 0) return null;
  const prev = items[idx]!;
  const next: WorkoutSetDraftItem = {
    ...prev,
    body: { ...prev.body, ...patch },
  };
  items[idx] = next;
  writeQueue(items);
  return next;
}

export function listWorkoutFinishDrafts(): WorkoutFinishDraftItem[] {
  return readFinishQueue();
}

export function countWorkoutFinishDrafts(): number {
  return readFinishQueue().length;
}

/** Total gym drafts (sets + finish) for tab badge / banner. */
export function countWorkoutOfflineDrafts(): number {
  return countWorkoutSetDrafts() + countWorkoutFinishDrafts();
}

/** Include local offline sessions in badge count when helper is available. */
export function countAllWorkoutOfflineDrafts(
  localSessionCount = 0,
): number {
  return countWorkoutOfflineDrafts() + localSessionCount;
}

export function enqueueWorkoutFinishDraft(sessionId: string): string {
  const existing = readFinishQueue().find((item) => item.sessionId === sessionId);
  if (existing) return existing.id;
  const id =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `wfin-${Date.now()}`;
  const items = readFinishQueue();
  items.push({
    id,
    kind: "failed-workout-finish",
    createdAt: new Date().toISOString(),
    sessionId,
  });
  writeFinishQueue(items);
  return id;
}

export function removeWorkoutFinishDraft(id: string): void {
  writeFinishQueue(readFinishQueue().filter((item) => item.id !== id));
}

/** Remap local session/exercise ids after an offline session is synced. */
export function remapWorkoutDraftIds(input: {
  sessionIdMap?: Record<string, string>;
  exerciseIdMap?: Record<string, string>;
}): void {
  const sessionMap = input.sessionIdMap ?? {};
  const exerciseMap = input.exerciseIdMap ?? {};
  if (Object.keys(sessionMap).length === 0 && Object.keys(exerciseMap).length === 0) {
    return;
  }

  const sets = readQueue().map((item) => ({
    ...item,
    sessionId: sessionMap[item.sessionId] ?? item.sessionId,
    exerciseId: exerciseMap[item.exerciseId] ?? item.exerciseId,
  }));
  writeQueue(sets);

  const finishes = readFinishQueue().map((item) => ({
    ...item,
    sessionId: sessionMap[item.sessionId] ?? item.sessionId,
  }));
  writeFinishQueue(finishes);
}
