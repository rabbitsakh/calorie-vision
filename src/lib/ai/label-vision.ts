import type { FoodRecognitionResult } from "../food-types";

function hasPer100g(result: FoodRecognitionResult): boolean {
  return (result.per100g?.calories ?? 0) > 0;
}

function hasPortionMacros(result: FoodRecognitionResult): boolean {
  if (result.calories <= 0) return false;
  const macros = [result.protein, result.fat, result.carbs].filter((v) => v !== undefined);
  return macros.length >= 2;
}

/** True when label nutrition is missing after the main vision pass. */
export function shouldRunLabelPass(result: FoodRecognitionResult): boolean {
  if (result.photoKind !== "label") return false;
  return !(hasPer100g(result) || hasPortionMacros(result));
}

/** Prefer the candidate when it actually carries readable label nutrition. */
export function isBetterLabelResult(
  current: FoodRecognitionResult,
  candidate: FoodRecognitionResult,
): boolean {
  const curScore = (hasPer100g(current) ? 2 : 0) + (hasPortionMacros(current) ? 1 : 0);
  const newScore = (hasPer100g(candidate) ? 2 : 0) + (hasPortionMacros(candidate) ? 1 : 0);
  return newScore > curScore;
}
