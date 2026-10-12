/**
 * Shopping list lives in localStorage and works offline.
 * This flag tracks whether the local copy still needs a successful PUT
 * to the server (Wave J — offline queue completeness).
 *
 * Count is 0|1: the list is already local; the badge means “needs sync”.
 */

export const SHOPPING_SYNC_DIRTY_KEY = "cv-shopping-sync-dirty-v1";

type Listener = () => void;

const listeners = new Set<Listener>();

export function subscribeShoppingSyncDraft(listener: Listener): () => void {
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

function storage(): Storage | null {
  try {
    if (typeof window === "undefined") return null;
    return window.localStorage;
  } catch {
    return null;
  }
}

export function isShoppingSyncDirty(): boolean {
  const store = storage();
  if (!store) return false;
  try {
    return store.getItem(SHOPPING_SYNC_DIRTY_KEY) === "1";
  } catch {
    return false;
  }
}

export function countShoppingSyncDrafts(): number {
  return isShoppingSyncDirty() ? 1 : 0;
}

export function markShoppingSyncDirty(): void {
  const store = storage();
  if (!store) return;
  try {
    store.setItem(SHOPPING_SYNC_DIRTY_KEY, "1");
    notify();
  } catch {
    // quota / private mode
  }
}

export function clearShoppingSyncDirty(): void {
  const store = storage();
  if (!store) return;
  try {
    store.removeItem(SHOPPING_SYNC_DIRTY_KEY);
    notify();
  } catch {
    // ignore
  }
}
