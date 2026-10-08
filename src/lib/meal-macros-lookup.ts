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
  brand?: string | null;
  lookupMode?: string | null;
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
  brand?: string | null;
  lookupMode?: string | null;
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
  brand?: string | null;
  lookupMode?: string | null;
};

/** Query for /api/food/lookup — append brand so branded soft-saves don't repair as generic. */
export function buildMacrosRepairQuery(
  meal: Pick<MealLookupSource, "dishName" | "brand">,
): string {
  const name = meal.dishName.trim();
  const brand = meal.brand?.trim();
  if (!name) return "";
  if (!brand) return name;
  // Avoid "Brand Brand Product" when the name already starts with the brand.
  if (name.toLowerCase().startsWith(brand.toLowerCase())) return name;
  return `${name} ${brand}`;
}

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
  const brand =
    looked.brand !== undefined
      ? looked.brand?.trim() || null
      : meal.brand?.trim() || null;
  const lookupMode =
    looked.lookupMode !== undefined
      ? looked.lookupMode?.trim() || null
      : meal.lookupMode?.trim() || null;

  return {
    dishName,
    calories: Math.max(1, Math.round(scaled.calories)),
    protein: scaled.protein ?? null,
    fat: scaled.fat ?? null,
    carbs: scaled.carbs ?? null,
    fiber: scaled.fiber ?? null,
    sugar: scaled.sugar ?? null,
    portionGrams: targetPortion,
    brand,
    lookupMode,
  };
}
