import type { FoodRecognitionResult } from "./food-types";

const DEFAULT_MEAL_PORTION_GRAMS = 250;
const DEFAULT_PORTION_GRAMS = 100;
const PER100G_MAX_CALORIES = 120;
const LOW_DENSITY_KCAL_PER_GRAM = 0.25;

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

type Per100gValues = {
  calories: number;
  protein?: number;
  fat?: number;
  carbs?: number;
};

/** GigaChat often returns per-100 g/ml values while portionGrams is the full bottle or plate. */
export function inferPer100gValues(
  result: Pick<FoodRecognitionResult, "per100g" | "protein" | "fat" | "carbs">,
  calories: number,
  portionGrams: number,
): Per100gValues | null {
  if (result.per100g && result.per100g.calories > 0) {
    return result.per100g;
  }

  if (portionGrams <= 100 || calories <= 0) {
    return null;
  }

  const density = calories / portionGrams;
  const macrosLookPer100g =
    (result.carbs === undefined || result.carbs <= 25) &&
    (result.protein === undefined || result.protein <= 25);

  if (
    calories <= PER100G_MAX_CALORIES &&
    density < LOW_DENSITY_KCAL_PER_GRAM &&
    macrosLookPer100g
  ) {
    return {
      calories,
      protein: result.protein,
      fat: result.fat,
      carbs: result.carbs,
    };
  }

  return null;
}

function scaleMacro(value: number | undefined, ratio: number): number | undefined {
  if (value === undefined) {
    return undefined;
  }
  return Math.round(value * ratio * 10) / 10;
}

function scaleFromPer100g(per100g: Per100gValues, grams: number): Per100gValues & { portionGrams: number } | null {
  if (!Number.isFinite(grams) || grams <= 0 || !Number.isFinite(per100g.calories)) {
    return null;
  }

  const ratio = grams / 100;
  return {
    calories: Math.max(0, Math.round(per100g.calories * ratio)),
    protein: scaleMacro(per100g.protein, ratio),
    fat: scaleMacro(per100g.fat, ratio),
    carbs: scaleMacro(per100g.carbs, ratio),
    portionGrams: grams,
  };
}

export function normalizeRecognitionNutrition(result: FoodRecognitionResult): FoodRecognitionResult {
  let calories = result.calories;
  let protein = result.protein;
  let fat = result.fat;
  let carbs = result.carbs;
  let portionGrams = result.portionGrams;

  if (!portionGrams || portionGrams <= 0) {
    portionGrams =
      result.photoKind === "meal" ? DEFAULT_MEAL_PORTION_GRAMS : DEFAULT_PORTION_GRAMS;
  }

  const per100gSource = inferPer100gValues(result, calories, portionGrams);
  if (per100gSource) {
    const scaled = scaleFromPer100g(per100gSource, portionGrams);
    if (scaled) {
      calories = scaled.calories;
      protein = scaled.protein;
      fat = scaled.fat;
      carbs = scaled.carbs;
    }
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
