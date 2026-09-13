/**
 * Unified food-add open API (Wave C0).
 * Dispatched on `window` so tab bar / CTAs stay decoupled from the sheet host.
 */

export type FoodAddMode = "photo" | "text" | "barcode";

export type OpenFoodAddDetail = {
  /** Omit to show the mode picker first. */
  mode?: FoodAddMode;
  /** When mode is photo, also open the device camera picker. */
  openCamera?: boolean;
  /** Prefill meal type on confirm (push deep link). */
  mealType?: string;
  /** Open sheet and resume pending-confirm draft if any. */
  resumePending?: boolean;
};

export const OPEN_FOOD_ADD_EVENT = "cv-open-food-add";
/** Fired after a meal is saved from the add sheet — ration refreshes. */
export const FOOD_SAVED_EVENT = "cv-food-saved";

export function openFoodAdd(detail: OpenFoodAddDetail = {}): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent<OpenFoodAddDetail>(OPEN_FOOD_ADD_EVENT, { detail }));
}

/** Explicit photo CTA — skips mode picker, opens camera. */
export function requestOpenFoodCamera(_scrollFirst = true): void {
  openFoodAdd({ mode: "photo", openCamera: true });
}

/** Explicit text CTA — skips mode picker. */
export function requestOpenFoodText(_scrollFirst = true): void {
  openFoodAdd({ mode: "text" });
}

/** Explicit barcode CTA — skips mode picker. */
export function requestOpenFoodBarcode(): void {
  openFoodAdd({ mode: "barcode" });
}

/** Bare «+» / «Добавить» — mode picker. */
export function requestOpenFoodAddPicker(): void {
  openFoodAdd({});
}

/** Resume unfinished confirm draft (if present). */
export function requestOpenPendingConfirm(): void {
  openFoodAdd({ resumePending: true });
}

export function notifyFoodSaved(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(FOOD_SAVED_EVENT));
}
