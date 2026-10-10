/**
 * Offline queue for PUT /api/diary-note (Wave U evening check-in).
 */

import { applyOptimisticDiaryMood } from "@/lib/ration-day-cache-optimistic";

export const DIARY_NOTE_DRAFT_QUEUE_KEY = "cv-diary-note-draft-queue-v1";

export type DiaryNoteDraftItem = {
  id: string;
  kind: "failed-diary-note";
  createdAt: string;
  date: string;
  note: string;
  mood: number | null;
};

type Listener = () => void;

const listeners = new Set<Listener>();

export function subscribeDiaryNoteDraftQueue(listener: Listener): () => void {
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

function readQueue(): DiaryNoteDraftItem[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(DIARY_NOTE_DRAFT_QUEUE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (item): item is DiaryNoteDraftItem =>
        item != null &&
        typeof item === "object" &&
        typeof (item as DiaryNoteDraftItem).id === "string" &&
        (item as DiaryNoteDraftItem).kind === "failed-diary-note" &&
        typeof (item as DiaryNoteDraftItem).date === "string" &&
        typeof (item as DiaryNoteDraftItem).note === "string",
    );
  } catch {
    return [];
  }
}

function writeQueue(items: DiaryNoteDraftItem[]): void {
  if (typeof window === "undefined") return;
  try {
    if (items.length === 0) {
      localStorage.removeItem(DIARY_NOTE_DRAFT_QUEUE_KEY);
    } else {
      localStorage.setItem(DIARY_NOTE_DRAFT_QUEUE_KEY, JSON.stringify(items.slice(-20)));
    }
    notify();
  } catch {
    // quota / private mode
  }
}

export function listDiaryNoteDrafts(): DiaryNoteDraftItem[] {
  return readQueue();
}

export function countDiaryNoteDrafts(): number {
  return readQueue().length;
}

export function enqueueDiaryNoteDraft(input: {
  date: string;
  note: string;
  mood: number | null;
}): string {
  // One draft per day — latest mood wins.
  const items = readQueue().filter((item) => item.date !== input.date);
  const id =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `diary-${Date.now()}`;
  items.push({
    id,
    kind: "failed-diary-note",
    createdAt: new Date().toISOString(),
    date: input.date,
    note: input.note,
    mood: input.mood,
  });
  writeQueue(items);
  try {
    if (input.mood != null) {
      applyOptimisticDiaryMood(input.date, input.mood);
    }
  } catch {
    // ignore
  }
  return id;
}

export function removeDiaryNoteDraft(id: string): void {
  writeQueue(readQueue().filter((item) => item.id !== id));
}
