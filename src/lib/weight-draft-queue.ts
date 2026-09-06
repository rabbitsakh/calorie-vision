export const WEIGHT_DRAFT_QUEUE_KEY = "cv-weight-draft-queue-v1";

export type WeightDraftItem = {
  id: string;
  kind: "failed-weight";
  createdAt: string;
  date: string;
  weightKg: number;
  measuredAt: string;
  note: string | null;
};

type Listener = () => void;

const listeners = new Set<Listener>();

export function subscribeWeightDraftQueue(listener: Listener): () => void {
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

function readQueue(): WeightDraftItem[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(WEIGHT_DRAFT_QUEUE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (item): item is WeightDraftItem =>
        item != null &&
        typeof item === "object" &&
        typeof (item as WeightDraftItem).id === "string" &&
        (item as WeightDraftItem).kind === "failed-weight" &&
        typeof (item as WeightDraftItem).date === "string" &&
        typeof (item as WeightDraftItem).weightKg === "number" &&
        typeof (item as WeightDraftItem).measuredAt === "string",
    );
  } catch {
    return [];
  }
}

function writeQueue(items: WeightDraftItem[]): void {
  if (typeof window === "undefined") return;
  try {
    if (items.length === 0) {
      localStorage.removeItem(WEIGHT_DRAFT_QUEUE_KEY);
    } else {
      localStorage.setItem(WEIGHT_DRAFT_QUEUE_KEY, JSON.stringify(items.slice(-40)));
    }
    notify();
  } catch {
    // quota / private mode
  }
}

export function listWeightDrafts(): WeightDraftItem[] {
  return readQueue();
}

export function countWeightDrafts(): number {
  return readQueue().length;
}

export function enqueueWeightDraft(input: {
  date: string;
  weightKg: number;
  measuredAt: string;
  note?: string | null;
}): string {
  const id =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `weight-${Date.now()}`;
  const items = readQueue();
  items.push({
    id,
    kind: "failed-weight",
    createdAt: new Date().toISOString(),
    date: input.date,
    weightKg: input.weightKg,
    measuredAt: input.measuredAt,
    note: input.note ?? null,
  });
  writeQueue(items);
  return id;
}

export function removeWeightDraft(id: string): void {
  writeQueue(readQueue().filter((item) => item.id !== id));
}
