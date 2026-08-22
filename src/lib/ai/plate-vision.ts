import type { FoodRecognitionResult } from "../food-types";
import { getRecognitionRetryReason } from "./recognition-retry";

function looksLikeMultiDishName(dishName: string): boolean {
  return (dishName.match(/,/g) ?? []).length >= 1 || /\s+и\s+/i.test(dishName);
}

export { looksLikeMultiDishName };

/** Whether a plate-focused vision pass is worth another GigaChat call. */
export function shouldRunPlatePass(result: FoodRecognitionResult): boolean {
  const itemCount = result.items?.length ?? 0;
  if (itemCount >= 2) return false;

  const looksMeal = result.photoKind === "meal" || result.photoKind === undefined;
  const misclassifiedPackage =
    result.photoKind === "package" && !result.barcode?.trim() && looksLikeMultiDishName(result.dishName);

  if (looksMeal || misclassifiedPackage) {
    if (looksLikeMultiDishName(result.dishName)) return true;
  }

  if (!looksMeal) return false;

  // Generic weak plate: named meal with no calories/items.
  return (
    result.calories <= 0 &&
    itemCount === 0 &&
    result.confidence >= 0.4
  );
}

/** Comma-list plate with no items — run plate specialist before a text retry. */
export function shouldForcePlateBeforeRetry(result: FoodRecognitionResult): boolean {
  return (
    getRecognitionRetryReason(result) === "plate-list-without-items" && shouldRunPlatePass(result)
  );
}

/** Prefer the candidate when it actually splits the plate into items. */
export function isBetterPlateResult(
  current: FoodRecognitionResult,
  candidate: FoodRecognitionResult,
): boolean {
  const curItems = current.items?.length ?? 0;
  const newItems = candidate.items?.length ?? 0;
  if (newItems >= 2 && newItems > curItems) return true;
  if (newItems >= 2 && curItems < 2) return true;
  return false;
}
