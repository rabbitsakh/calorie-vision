import type { RecognitionResponse } from "@/types";
import type { SaveMealInput } from "@/lib/save-meal";
import { deleteOfflinePhoto, loadOfflinePhoto, saveOfflinePhoto } from "@/lib/offline-photo-store";

export const MEAL_DRAFT_QUEUE_KEY = "cv-meal-draft-queue-v1";

export type PendingConfirmDraft = {
  id: string;
  kind: "pending-confirm";
  createdAt: string;
  selectedDate: string;
  result: RecognitionResponse;
};

export type PendingRecognitionDraft = {
  id: string;
  kind: "pending-recognition";
  createdAt: string;
  selectedDate: string;
  fileName: string;
  mimeType: string;
  restaurantMode?: boolean;
  barcode?: string;
};

export type FailedSaveDraft = {
  id: string;
  kind: "failed-save";
  createdAt: string;
  selectedDate: string;
  body: SaveMealInput | { entries: SaveMealInput[] };
};

export type MealDraftItem = PendingConfirmDraft | PendingRecognitionDraft | FailedSaveDraft;

type Listener = () => void;

const queueListeners = new Set<Listener>();

export function subscribeMealDraftQueue(listener: Listener): () => void {
  queueListeners.add(listener);
  return () => {
    queueListeners.delete(listener);
  };
}

function notifyMealDraftQueue(): void {
  for (const listener of queueListeners) {
    try {
      listener();
    } catch {
      // ignore
    }
  }
}

function readQueue(): MealDraftItem[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(MEAL_DRAFT_QUEUE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (item): item is MealDraftItem =>
        item != null &&
        typeof item === "object" &&
        typeof (item as MealDraftItem).id === "string" &&
        ((item as MealDraftItem).kind === "pending-confirm" ||
          (item as MealDraftItem).kind === "pending-recognition" ||
          (item as MealDraftItem).kind === "failed-save"),
    );
  } catch {
    return [];
  }
}

function writeQueue(items: MealDraftItem[]): void {
  if (typeof window === "undefined") return;
  try {
    if (items.length === 0) {
      localStorage.removeItem(MEAL_DRAFT_QUEUE_KEY);
    } else {
      localStorage.setItem(MEAL_DRAFT_QUEUE_KEY, JSON.stringify(items.slice(-20)));
    }
    notifyMealDraftQueue();
  } catch {
    // quota / private mode
  }
}

export function listMealDrafts(): MealDraftItem[] {
  return readQueue();
}

export function getPendingConfirmDraft(selectedDate?: string): PendingConfirmDraft | null {
  const items = readQueue().filter((item): item is PendingConfirmDraft => item.kind === "pending-confirm");
  if (selectedDate) {
    return items.find((item) => item.selectedDate === selectedDate) ?? items[0] ?? null;
  }
  return items[0] ?? null;
}

export function upsertPendingConfirmDraft(
  selectedDate: string,
  result: RecognitionResponse,
  id = "pending-confirm",
): void {
  const items = readQueue().filter(
    (item) => !(item.kind === "pending-confirm" && item.selectedDate === selectedDate),
  );
  items.push({
    id,
    kind: "pending-confirm",
    createdAt: new Date().toISOString(),
    selectedDate,
    result,
  });
  writeQueue(items);
}

export function clearPendingConfirmDraft(selectedDate?: string): void {
  const items = readQueue().filter((item) => {
    if (item.kind !== "pending-confirm") return true;
    if (!selectedDate) return false;
    return item.selectedDate !== selectedDate;
  });
  writeQueue(items);
}

export function enqueueFailedSave(
  selectedDate: string,
  body: SaveMealInput | { entries: SaveMealInput[] },
): string {
  const id =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `failed-${Date.now()}`;
  const items = readQueue();
  items.push({
    id,
    kind: "failed-save",
    createdAt: new Date().toISOString(),
    selectedDate,
    body,
  });
  writeQueue(items);
  return id;
}

export function removeMealDraft(id: string): void {
  const item = readQueue().find((draft) => draft.id === id);
  writeQueue(readQueue().filter((draft) => draft.id !== id));
  if (item?.kind === "pending-recognition") {
    void deleteOfflinePhoto(item.id);
  }
}

export async function enqueuePendingRecognition(
  selectedDate: string,
  file: File,
  options?: { restaurantMode?: boolean; barcode?: string },
): Promise<string> {
  const id =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `recognition-${Date.now()}`;
  await saveOfflinePhoto(id, file);
  const items = readQueue();
  items.push({
    id,
    kind: "pending-recognition",
    createdAt: new Date().toISOString(),
    selectedDate,
    fileName: file.name || "photo.jpg",
    mimeType: file.type || "image/jpeg",
    restaurantMode: options?.restaurantMode,
    barcode: options?.barcode,
  });
  writeQueue(items);
  return id;
}

export function listPendingRecognitions(): PendingRecognitionDraft[] {
  return readQueue().filter((item): item is PendingRecognitionDraft => item.kind === "pending-recognition");
}

export function countPendingRecognitions(): number {
  return listPendingRecognitions().length;
}

export function countOfflineQueue(): number {
  return countFailedSaves() + countPendingRecognitions();
}

export async function pendingRecognitionToFile(item: PendingRecognitionDraft): Promise<File | null> {
  const blob = await loadOfflinePhoto(item.id);
  if (!blob) {
    return null;
  }
  return new File([blob], item.fileName, { type: item.mimeType || blob.type || "image/jpeg" });
}

export function countFailedSaves(): number {
  return readQueue().filter((item) => item.kind === "failed-save").length;
}

export function listFailedSaves(): FailedSaveDraft[] {
  return readQueue().filter((item): item is FailedSaveDraft => item.kind === "failed-save");
}
