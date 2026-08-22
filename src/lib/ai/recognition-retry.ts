import type { FoodRecognitionResult } from "../food-types";

export type RecognitionRetryReason =
  | "failed-name"
  | "plate-list-without-items"
  | "zero-calorie-meal"
  | "vague-name"
  | "empty-label";

const VAGUE_NAME_RE =
  /^(еда|блюдо|ужин|обед|завтрак|перекус|food|meal|snack|продукт|набор)$/i;

function looksLikeMultiDishName(dishName: string): boolean {
  return (dishName.match(/,/g) ?? []).length >= 1 || /\s+и\s+/i.test(dishName);
}

/** Why a second vision pass is warranted — null when the first result is fine. */
export function getRecognitionRetryReason(
  result: FoodRecognitionResult,
): RecognitionRetryReason | null {
  if (/не удалось распознать/i.test(result.dishName)) {
    return "failed-name";
  }

  const looksPlatedMeal =
    result.photoKind === "meal" || result.photoKind === undefined;
  const itemCount = result.items?.length ?? 0;

  if (looksPlatedMeal && looksLikeMultiDishName(result.dishName) && itemCount < 2) {
    return "plate-list-without-items";
  }

  if (
    looksPlatedMeal &&
    result.calories <= 0 &&
    itemCount === 0 &&
    result.confidence >= 0.4
  ) {
    return "zero-calorie-meal";
  }

  if (
    looksPlatedMeal &&
    VAGUE_NAME_RE.test(result.dishName.trim()) &&
    result.confidence < 0.85
  ) {
    return "vague-name";
  }

  if (
    result.photoKind === "label" &&
    result.calories <= 0 &&
    (result.per100g?.calories ?? 0) <= 0 &&
    result.confidence >= 0.35
  ) {
    return "empty-label";
  }

  return null;
}

/** True when a second vision pass is likely to fix a weak first response. */
export function shouldRetryFoodRecognition(result: FoodRecognitionResult): boolean {
  return getRecognitionRetryReason(result) !== null;
}

/** Prefer the candidate when it clearly improves on the current weak result. */
export function isBetterRecognitionResult(
  current: FoodRecognitionResult,
  candidate: FoodRecognitionResult,
): boolean {
  if (/не удалось распознать/i.test(candidate.dishName)) {
    return false;
  }

  const curItems = current.items?.length ?? 0;
  const newItems = candidate.items?.length ?? 0;
  if (newItems > curItems) return true;

  if (candidate.calories > current.calories && current.calories <= 0) return true;

  if (
    shouldRetryFoodRecognition(current) &&
    !shouldRetryFoodRecognition(candidate) &&
    !/не удалось распознать/i.test(candidate.dishName)
  ) {
    return true;
  }

  if (
    VAGUE_NAME_RE.test(current.dishName.trim()) &&
    !VAGUE_NAME_RE.test(candidate.dishName.trim()) &&
    candidate.calories > 0
  ) {
    return true;
  }

  const curPer100 = current.per100g?.calories ?? 0;
  const newPer100 = candidate.per100g?.calories ?? 0;
  if (current.photoKind === "label" && newPer100 > curPer100) return true;

  return false;
}
