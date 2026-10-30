/** Ask ChestDock to open the next ready chest (evening «Закрыть день»). */

export const OPEN_CHEST_QUICK_EVENT = "cv:open-chest-quick";

export function requestOpenChestQuick(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(OPEN_CHEST_QUICK_EVENT));
}
