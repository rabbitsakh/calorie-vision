/**
 * Wave R/O — queue chest mark/open while offline (no silent drop).
 */

export const REWARDS_DRAFT_QUEUE_KEY = "cv-rewards-draft-queue-v1";

export type RewardsDraftBody = {
  source: string;
  action?: "mark" | "open";
  date?: string;
  weekStart?: string;
  challengeKey?: string;
  milestone?: number;
};

export type RewardsDraftItem = {
  id: string;
  kind: "mark" | "open";
  createdAt: string;
  body: RewardsDraftBody;
};

type Listener = () => void;
const listeners = new Set<Listener>();

export function subscribeRewardsDraftQueue(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function notify(): void {
  for (const l of listeners) {
    try {
      l();
    } catch {
      // ignore
    }
  }
}

function storage(): Storage | null {
  try {
    if (typeof localStorage === "undefined") return null;
    return localStorage;
  } catch {
    return null;
  }
}

function readQueue(): RewardsDraftItem[] {
  const ls = storage();
  if (!ls) return [];
  try {
    const raw = ls.getItem(REWARDS_DRAFT_QUEUE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (item): item is RewardsDraftItem =>
        Boolean(
          item &&
            typeof item === "object" &&
            typeof (item as RewardsDraftItem).id === "string" &&
            ((item as RewardsDraftItem).kind === "mark" ||
              (item as RewardsDraftItem).kind === "open") &&
            (item as RewardsDraftItem).body &&
            typeof (item as RewardsDraftItem).body === "object",
        ),
    );
  } catch {
    return [];
  }
}

function writeQueue(items: RewardsDraftItem[]): void {
  const ls = storage();
  if (!ls) return;
  try {
    if (items.length === 0) {
      ls.removeItem(REWARDS_DRAFT_QUEUE_KEY);
    } else {
      ls.setItem(REWARDS_DRAFT_QUEUE_KEY, JSON.stringify(items.slice(-20)));
    }
    notify();
  } catch {
    // quota
  }
}

export function listRewardsDrafts(): RewardsDraftItem[] {
  return readQueue();
}

export function countRewardsDrafts(): number {
  return readQueue().length;
}

function newId(prefix: string): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${prefix}-${Date.now()}`;
}

/**
 * Enqueue a rewards POST. Dedupes mark-by-date and keeps a single open draft.
 */
export function enqueueRewardsDraft(body: RewardsDraftBody): string {
  const kind: "mark" | "open" = body.action === "open" || body.source === "next" ? "open" : "mark";
  let items = readQueue();

  if (kind === "mark" && body.date) {
    items = items.filter(
      (i) => !(i.kind === "mark" && i.body.date === body.date),
    );
  }
  if (kind === "open") {
    items = items.filter((i) => i.kind !== "open");
  }

  const id = newId(`rewards-${kind}`);
  items.push({
    id,
    kind,
    createdAt: new Date().toISOString(),
    body: { ...body },
  });
  writeQueue(items);
  return id;
}

export function removeRewardsDraft(id: string): void {
  writeQueue(readQueue().filter((i) => i.id !== id));
}

export function resetRewardsDraftQueueForTests(): void {
  writeQueue([]);
}
