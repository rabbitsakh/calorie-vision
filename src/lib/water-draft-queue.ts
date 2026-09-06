export const WATER_DRAFT_QUEUE_KEY = "cv-water-draft-queue-v1";

export type WaterDraftItem = {
  id: string;
  kind: "failed-water";
  createdAt: string;
  selectedDate: string;
  ml: number;
};

type Listener = () => void;

const listeners = new Set<Listener>();

export function subscribeWaterDraftQueue(listener: Listener): () => void {
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

function readQueue(): WaterDraftItem[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(WATER_DRAFT_QUEUE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (item): item is WaterDraftItem =>
        item != null &&
        typeof item === "object" &&
        typeof (item as WaterDraftItem).id === "string" &&
        (item as WaterDraftItem).kind === "failed-water" &&
        typeof (item as WaterDraftItem).selectedDate === "string" &&
        typeof (item as WaterDraftItem).ml === "number",
    );
  } catch {
    return [];
  }
}

function writeQueue(items: WaterDraftItem[]): void {
  if (typeof window === "undefined") return;
  try {
    if (items.length === 0) {
      localStorage.removeItem(WATER_DRAFT_QUEUE_KEY);
    } else {
      localStorage.setItem(WATER_DRAFT_QUEUE_KEY, JSON.stringify(items.slice(-40)));
    }
    notify();
  } catch {
    // quota / private mode
  }
}

export function listWaterDrafts(): WaterDraftItem[] {
  return readQueue();
}

export function countWaterDrafts(): number {
  return readQueue().length;
}

export function enqueueWaterDraft(selectedDate: string, ml: number): string {
  const id =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `water-${Date.now()}`;
  const items = readQueue();
  items.push({
    id,
    kind: "failed-water",
    createdAt: new Date().toISOString(),
    selectedDate,
    ml,
  });
  writeQueue(items);
  return id;
}

export function removeWaterDraft(id: string): void {
  writeQueue(readQueue().filter((item) => item.id !== id));
}
