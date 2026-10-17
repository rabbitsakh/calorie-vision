/**
 * T8 — remember draft ids that failed a non-network flush so the queue
 * can show «Ошибка» instead of a perpetual «Ждёт сеть».
 */

export const OFFLINE_QUEUE_FLUSH_ERRORS_KEY = "cv-offline-queue-flush-errors-v1";

type Listener = () => void;
const listeners = new Set<Listener>();

export function subscribeOfflineQueueFlushErrors(listener: Listener): () => void {
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
    if (typeof sessionStorage === "undefined") return null;
    return sessionStorage;
  } catch {
    return null;
  }
}

function readIds(): Set<string> {
  const ls = storage();
  if (!ls) return new Set();
  try {
    const raw = ls.getItem(OFFLINE_QUEUE_FLUSH_ERRORS_KEY);
    if (!raw) return new Set();
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return new Set();
    return new Set(
      parsed.filter((id): id is string => typeof id === "string" && id.length > 0),
    );
  } catch {
    return new Set();
  }
}

function writeIds(ids: Set<string>): void {
  const ls = storage();
  if (!ls) return;
  try {
    ls.setItem(OFFLINE_QUEUE_FLUSH_ERRORS_KEY, JSON.stringify([...ids]));
  } catch {
    // quota
  }
  notify();
}

export function listOfflineQueueFlushErrors(): string[] {
  return [...readIds()];
}

export function hasOfflineQueueFlushError(id: string): boolean {
  return readIds().has(id);
}

export function markOfflineQueueFlushError(id: string): void {
  const next = readIds();
  if (next.has(id)) return;
  next.add(id);
  writeIds(next);
}

export function clearOfflineQueueFlushError(id: string): void {
  const next = readIds();
  if (!next.delete(id)) return;
  writeIds(next);
}

export function clearAllOfflineQueueFlushErrors(): void {
  writeIds(new Set());
}
