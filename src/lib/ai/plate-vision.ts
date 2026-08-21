import type { FoodRecognitionResult } from "@/lib/food-types";
import { shouldRetryFoodRecognition } from "@/lib/ai/recognition-retry";

function looksLikeMultiDishName(dishName: string): boolean {
  return (dishName.match(/,/g) ?? []).length >= 1 || /\s+и\s+/i.test(dishName);
}

/** Whether a plate-focused vision pass is worth another GigaChat call. */
export function shouldRunPlatePass(result: FoodRecognitionResult): boolean {
  const looksMeal = result.photoKind === "meal" || result.photoKind === undefined;
  if (!looksMeal) return false;

  const itemCount = result.items?.length ?? 0;
  if (itemCount >= 2) return false;

  if (looksLikeMultiDishName(result.dishName)) return true;

  // Generic retry still unhappy → try a specialist plate prompt.
  return shouldRetryFoodRecognition(result);
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
