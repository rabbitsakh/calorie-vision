/**
 * Quick water sheet open API — same event style as food-add / weight-quick.
 * Center «+» can log ml without leaving the current tab.
 */

export const OPEN_WATER_QUICK_EVENT = "cv-open-water-quick";

/** Fired after a successful water log (quick sheet or tracker) so ration UI can refresh. */
export const WATER_LOGGED_EVENT = "cv-water-logged";

export function requestOpenWaterQuick(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(OPEN_WATER_QUICK_EVENT));
}

export function notifyWaterLogged(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(WATER_LOGGED_EVENT));
}
