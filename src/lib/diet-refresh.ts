/** Fired after sex / weight / goal saves so ration targets can refetch without a full reload. */
export const DIET_TARGETS_CHANGED_EVENT = "calorie-vision:diet-targets-changed";

export function notifyDietTargetsChanged() {
  if (typeof window === "undefined") {
    return;
  }
  window.dispatchEvent(new Event(DIET_TARGETS_CHANGED_EVENT));
}
