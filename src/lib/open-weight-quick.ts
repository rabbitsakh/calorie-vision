/**
 * Quick weight sheet open API — same event style as food-add.
 * Center «+» can log kg without leaving the current tab.
 */

export const OPEN_WEIGHT_QUICK_EVENT = "cv-open-weight-quick";

export function requestOpenWeightQuick(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(OPEN_WEIGHT_QUICK_EVENT));
}
