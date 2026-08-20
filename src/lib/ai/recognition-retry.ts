import type { FoodRecognitionResult } from "../food-types";

/** True when a second vision pass is likely to fix a weak first response. */
export function shouldRetryFoodRecognition(result: FoodRecognitionResult): boolean {
  if (/не удалось распознать/i.test(result.dishName)) {
    return true;
  }

  const looksPlatedMeal =
    result.photoKind === "meal" || result.photoKind === undefined;
  const commaSeparated =
    (result.dishName.match(/,/g) ?? []).length >= 1 ||
    /\s+и\s+/i.test(result.dishName);

  if (
    looksPlatedMeal &&
    commaSeparated &&
    (!result.items || result.items.length < 2)
  ) {
    return true;
  }

  if (
    looksPlatedMeal &&
    result.calories <= 0 &&
    (!result.items || result.items.length === 0) &&
    result.confidence >= 0.4
  ) {
    return true;
  }

  return false;
}
