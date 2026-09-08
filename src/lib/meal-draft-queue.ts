import type { RecognitionResponse } from "@/types";
import type { NutritionValues } from "@/lib/nutrition";
import type { SaveMealInput } from "@/lib/save-meal";
import { deleteOfflinePhoto, loadOfflinePhoto, saveOfflinePhoto } from "@/lib/offline-photo-store";

export const MEAL_DRAFT_QUEUE_KEY = "cv-meal-draft-queue-v1";

/** Editable confirm fields persisted across reload / PWA kill (1.11.1). */
export type PendingConfirmDishUi = {
  id: string;
  dishName: string;
  calories: string;
  protein: string;
  fat: string;
  carbs: string;
  fiber: string;
  sugar: string;
  portionGrams: string;
  baseline: NutritionValues | null;
};

export type PendingConfirmUi = {
  mealType?: string;
  eatenTime?: string;
  allergenAck?: boolean;
  activeDish?: number;
  dishes?: PendingConfirmDishUi[];
};

export type PendingConfirmDraft = {
  id: string;
  kind: "pending-confirm";
  createdAt: string;
  selectedDate: string;
  result: RecognitionResponse;
  /** User edits on the confirm screen; optional for older drafts. */
  ui?: PendingConfirmUi;
};

export type PendingRecognitionDraft = {
  id: string;
  kind: "pending-recognition";
  createdAt: string;
  selectedDate: string;
  fileName: string;
  mimeType: string;
  restaurantMode?: boolean;
  recognitionContext?: "plate" | "label" | "restaurant";
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

export function countPendingConfirms(): number {
  return readQueue().filter((item) => item.kind === "pending-confirm").length;
}

function sameConfirmPhoto(
  previous: RecognitionResponse | undefined,
  next: RecognitionResponse,
): boolean {
  if (!previous) return false;
  const prevPath = previous.imagePath?.trim() ?? "";
  const nextPath = next.imagePath?.trim() ?? "";
  if (prevPath && nextPath) return prevPath === nextPath;
  if (previous.previewUrl && next.previewUrl) return previous.previewUrl === next.previewUrl;
  return previous === next;
}

export type UpsertPendingConfirmOptions = {
  id?: string;
  /** Pass to replace UI; omit to keep existing UI when the same photo is upserted. */
  ui?: PendingConfirmUi | null;
};

export function upsertPendingConfirmDraft(
  selectedDate: string,
  result: RecognitionResponse,
  idOrOptions: string | UpsertPendingConfirmOptions = "pending-confirm",
): void {
  const options: UpsertPendingConfirmOptions =
    typeof idOrOptions === "string" ? { id: idOrOptions } : idOrOptions;
  const id = options.id ?? "pending-confirm";

  const existing = readQueue().find(
    (item): item is PendingConfirmDraft =>
      item.kind === "pending-confirm" && item.selectedDate === selectedDate,
  );

  let ui: PendingConfirmUi | undefined;
  if (options.ui === null) {
    ui = undefined;
  } else if (options.ui !== undefined) {
    ui = options.ui;
  } else if (existing?.ui && sameConfirmPhoto(existing.result, result)) {
    // Re-upsert / SSE enrichment for the same photo — keep edits.
    ui = existing.ui;
  }

  const items = readQueue().filter(
    (item) => !(item.kind === "pending-confirm" && item.selectedDate === selectedDate),
  );
  const next: PendingConfirmDraft = {
    id,
    kind: "pending-confirm",
    createdAt: existing?.createdAt ?? new Date().toISOString(),
    selectedDate,
    result,
  };
  if (ui) {
    next.ui = ui;
  }
  items.push(next);
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
  options?: { restaurantMode?: boolean; recognitionContext?: "plate" | "label" | "restaurant"; barcode?: string },
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
    recognitionContext: options?.recognitionContext,
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
