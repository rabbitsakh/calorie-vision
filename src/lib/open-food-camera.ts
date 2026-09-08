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
/** @deprecated Prefer OPEN_FOOD_ADD_EVENT — kept for stable tests / legacy listeners. */
export const OPEN_FOOD_CAMERA_EVENT = "cv-open-food-camera";
/** @deprecated Prefer OPEN_FOOD_ADD_EVENT */
export const OPEN_FOOD_TEXT_EVENT = "cv-open-food-text";
export const OPEN_FOOD_BARCODE_EVENT = "cv-open-food-barcode";
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

/** @deprecated Panel is in a sheet; no-op kept for callers. */
export function scrollToFoodAdd(): void {
  // no-op: add UI lives in FoodAddHost sheet
}
