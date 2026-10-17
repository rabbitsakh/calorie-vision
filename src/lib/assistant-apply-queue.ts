/**
 * Wave A6 — queue assistant apply (photo / meals / routine) while offline.
 * No LLM offline: only flush already-built confirm payloads when back online.
 */

export const ASSISTANT_APPLY_QUEUE_KEY = "cv-assistant-apply-queue-v1";

export type AssistantApplyKind =
  | "photo"
  | "meals"
  | "routine"
  | "shopping"
  | "start"
  | "water"
  | "weight";

export type PendingAssistantApply = {
  id: string;
  kind: AssistantApplyKind;
  createdAt: string;
  /** Body for POST /api/assistant/apply */
  body: Record<string, unknown>;
};

type Listener = () => void;
const listeners = new Set<Listener>();

export function subscribeAssistantApplyQueue(listener: Listener): () => void {
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

function readQueue(): PendingAssistantApply[] {
  const ls = storage();
  if (!ls) return [];
  try {
    const raw = ls.getItem(ASSISTANT_APPLY_QUEUE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (item): item is PendingAssistantApply =>
        Boolean(
          item &&
            typeof item === "object" &&
            typeof (item as PendingAssistantApply).id === "string" &&
            typeof (item as PendingAssistantApply).kind === "string" &&
            (item as PendingAssistantApply).body &&
            typeof (item as PendingAssistantApply).body === "object",
        ),
    );
  } catch {
    return [];
  }
}

function writeQueue(items: PendingAssistantApply[]): void {
  const ls = storage();
  if (!ls) return;
  try {
    ls.setItem(ASSISTANT_APPLY_QUEUE_KEY, JSON.stringify(items));
  } catch {
    // quota
  }
  notify();
}

export function listAssistantApplyQueue(): PendingAssistantApply[] {
  return readQueue();
}

export function countAssistantApplyQueue(): number {
  return readQueue().length;
}

export function enqueueAssistantApply(
  kind: AssistantApplyKind,
  body: Record<string, unknown>,
): string {
  const id =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `aa-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const item: PendingAssistantApply = {
    id,
    kind,
    createdAt: new Date().toISOString(),
    body: { ...body, kind },
  };
  writeQueue([...readQueue(), item]);
  return id;
}

export function removeAssistantApply(id: string): void {
  writeQueue(readQueue().filter((i) => i.id !== id));
}

export function clearAssistantApplyQueue(): void {
  writeQueue([]);
}
