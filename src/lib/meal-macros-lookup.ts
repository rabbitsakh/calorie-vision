/**
 * One-tap diary macros repair: /api/food/lookup → EditPatch for PATCH /api/meals/:id.
 */

import { scaleNutritionByPortion, type NutritionValues } from "@/lib/nutrition";

export type MealLookupSource = {
  dishName: string;
  calories: number;
  protein?: number | null;
  fat?: number | null;
  carbs?: number | null;
  fiber?: number | null;
  sugar?: number | null;
  portionGrams?: number | null;
};

export type FoodLookupRecognition = {
  dishName?: string;
  calories?: number;
  protein?: number | null;
  fat?: number | null;
  carbs?: number | null;
  fiber?: number | null;
  sugar?: number | null;
  portionGrams?: number | null;
};

export type MealMacrosPatch = {
  dishName: string;
  calories: number;
  protein?: number | null;
  fat?: number | null;
  carbs?: number | null;
  fiber?: number | null;
  sugar?: number | null;
  portionGrams?: number | null;
};

/** Merge lookup macros onto the meal, keeping the user's portion when possible. */
export function buildMacrosRepairPatch(
  meal: MealLookupSource,
  looked: FoodLookupRecognition,
): MealMacrosPatch | null {
  const lookedCalories = Number(looked.calories) || 0;
  const lookedProtein = Number(looked.protein);
  const lookedFat = Number(looked.fat);
  const lookedCarbs = Number(looked.carbs);
  const hasMacros =
    (Number.isFinite(lookedProtein) && lookedProtein > 0) ||
    (Number.isFinite(lookedFat) && lookedFat > 0) ||
    (Number.isFinite(lookedCarbs) && lookedCarbs > 0);
  if (lookedCalories <= 0 && !hasMacros) return null;

  const targetPortion =
    meal.portionGrams != null && Number.isFinite(meal.portionGrams) && meal.portionGrams > 0
      ? meal.portionGrams
      : looked.portionGrams != null && Number(looked.portionGrams) > 0
        ? Number(looked.portionGrams)
        : 100;

  const lookedPortion =
    looked.portionGrams != null && Number(looked.portionGrams) > 0
      ? Number(looked.portionGrams)
      : targetPortion;

  const baseline: NutritionValues = {
    calories: lookedCalories > 0 ? lookedCalories : meal.calories,
    protein: Number.isFinite(lookedProtein) ? lookedProtein : undefined,
    fat: Number.isFinite(lookedFat) ? lookedFat : undefined,
    carbs: Number.isFinite(lookedCarbs) ? lookedCarbs : undefined,
    fiber:
      looked.fiber != null && Number.isFinite(Number(looked.fiber))
        ? Number(looked.fiber)
        : undefined,
    sugar:
      looked.sugar != null && Number.isFinite(Number(looked.sugar))
        ? Number(looked.sugar)
        : undefined,
    portionGrams: lookedPortion,
  };

  const scaled = scaleNutritionByPortion(baseline, targetPortion) ?? baseline;
  const dishName = (looked.dishName ?? meal.dishName).trim() || meal.dishName;

  return {
    dishName,
    calories: Math.max(1, Math.round(scaled.calories)),
    protein: scaled.protein ?? null,
    fat: scaled.fat ?? null,
    carbs: scaled.carbs ?? null,
    fiber: scaled.fiber ?? null,
    sugar: scaled.sugar ?? null,
    portionGrams: targetPortion,
  };
}
