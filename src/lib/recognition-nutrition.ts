import type { FoodRecognitionResult } from "./food-types.ts";
import { nutritionFromPer100g } from "./open-food-facts.ts";

const DEFAULT_MEAL_PORTION_GRAMS = 250;
const DEFAULT_PORTION_GRAMS = 100;

function isFailedName(name: string): boolean {
  return /не удалось распознать/i.test(name);
}

export function needsNutritionLookup(result: FoodRecognitionResult): boolean {
  if (isFailedName(result.dishName)) {
    return false;
  }
  if (result.calories <= 0) {
    return true;
  }
  const macroCount = [result.protein, result.fat, result.carbs].filter(
    (value) => value !== undefined && value > 0,
  ).length;
  return macroCount < 2;
}

export function normalizeRecognitionNutrition(result: FoodRecognitionResult): FoodRecognitionResult {
  let calories = result.calories;
  let protein = result.protein;
  let fat = result.fat;
  let carbs = result.carbs;
  let portionGrams = result.portionGrams;

  if (calories <= 0 && result.per100g && result.per100g.calories > 0) {
    const grams =
      portionGrams && portionGrams > 0
        ? portionGrams
        : result.photoKind === "meal"
          ? DEFAULT_MEAL_PORTION_GRAMS
          : DEFAULT_PORTION_GRAMS;
    const scaled = nutritionFromPer100g(result.per100g, grams);
    if (scaled) {
      calories = scaled.calories;
      protein = scaled.protein;
      fat = scaled.fat;
      carbs = scaled.carbs;
      portionGrams = scaled.portionGrams;
    }
  }

  if (!portionGrams || portionGrams <= 0) {
    portionGrams =
      result.photoKind === "meal" ? DEFAULT_MEAL_PORTION_GRAMS : DEFAULT_PORTION_GRAMS;
  }

  return {
    ...result,
    calories: Math.max(0, Math.round(calories)),
    protein,
    fat,
    carbs,
    portionGrams,
  };
}
