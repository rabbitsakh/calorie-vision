/** Client event — milestone earned; ChestDock should reload the ready queue. */

export const CHEST_QUEUE_REFRESH_EVENT = "cv-chest-queue-refresh";

export function notifyChestQueueRefresh(): void {
  try {
    const w = (globalThis as { window?: Window }).window;
    w?.dispatchEvent(new CustomEvent(CHEST_QUEUE_REFRESH_EVENT));
  } catch {
    // ignore
  }
}

export function subscribeChestQueueRefresh(listener: () => void): () => void {
  const w = (globalThis as { window?: Window }).window;
  if (!w) return () => undefined;
  w.addEventListener(CHEST_QUEUE_REFRESH_EVENT, listener);
  return () => w.removeEventListener(CHEST_QUEUE_REFRESH_EVENT, listener);
}
