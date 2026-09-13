import type { FoodRecognitionResult } from "../food-types";
import { getRecognitionRetryReason } from "./recognition-retry";
import { looksLikeMultiDishName } from "./multi-dish-name";

export { looksLikeMultiDishName };

/** Canteen tray / multi-compartment lunch cues in the dish title. */
const CANTEEN_TRAY_NAME_RE =
  /поднос|комплексн|обед\s*№|ланчбокс|ланч-бокс|столов|три\s*блюд|несколько\s*блюд|meal\s*tray|canteen/iu;

/**
 * Explicit canteen/tray wording, or a dense multi-item list (2+ commas ≈ 3 dishes).
 */
export function looksLikeCanteenTrayName(dishName: string | undefined | null): boolean {
  const name = (dishName ?? "").trim();
  if (!name) return false;
  if (CANTEEN_TRAY_NAME_RE.test(name)) return true;
  return (name.match(/,/g) ?? []).length >= 2;
}

function incompletePlateItemCount(result: FoodRecognitionResult): number {
  const items = result.items ?? [];
  return items.filter(
    (item) => (item.calories ?? 0) <= 0 || !(item.portionGrams && item.portionGrams > 0),
  ).length;
}

/** Whether a plate-focused vision pass is worth another GigaChat call. */
export function shouldRunPlatePass(result: FoodRecognitionResult): boolean {
  const itemCount = result.items?.length ?? 0;
  if (itemCount >= 2) return false;

  const looksMeal = result.photoKind === "meal" || result.photoKind === undefined;
  const misclassifiedPackage =
    result.photoKind === "package" &&
    !result.barcode?.trim() &&
    looksLikeMultiDishName(result.dishName);

  if (looksMeal || misclassifiedPackage) {
    if (looksLikeMultiDishName(result.dishName)) return true;
    if (looksLikeCanteenTrayName(result.dishName)) return true;
  }

  if (!looksMeal) return false;

  // Generic weak plate: named meal with no calories/items.
  return result.calories <= 0 && itemCount === 0 && result.confidence >= 0.4;
}

/** Comma-list / canteen tray with no items — run plate specialist before a text retry. */
export function shouldForcePlateBeforeRetry(result: FoodRecognitionResult): boolean {
  const reason = getRecognitionRetryReason(result);
  if (reason === "plate-list-without-items" && shouldRunPlatePass(result)) return true;
  if (reason === "multi-dish-incomplete" && shouldRunPlatePass(result)) return true;
  if (looksLikeCanteenTrayName(result.dishName) && shouldRunPlatePass(result)) return true;
  return false;
}

/**
 * Prefer the candidate when it actually splits the plate into items,
 * or fills zero-kcal / missing-portion items (over only adding more items).
 */
export function isBetterPlateResult(
  current: FoodRecognitionResult,
  candidate: FoodRecognitionResult,
): boolean {
  const curItems = current.items?.length ?? 0;
  const newItems = candidate.items?.length ?? 0;
  const curIncomplete = incompletePlateItemCount(current);
  const newIncomplete = incompletePlateItemCount(candidate);

  if (curItems >= 2 && newItems >= 2) {
    if (newIncomplete < curIncomplete) return true;
    if (newIncomplete > curIncomplete) return false;
  }

  if (newItems >= 2 && newItems > curItems) return true;
  if (newItems >= 2 && curItems < 2) return true;
  return false;
}
