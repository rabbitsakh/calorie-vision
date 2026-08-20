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

/** True when the result has at least usable calorie totals to merge from. */
export function hasUsableCalories(result: FoodRecognitionResult): boolean {
  return Number.isFinite(result.calories) && result.calories > 0;
}

/**
 * Shorter lookup query when the vision name is too specific for OFF / GigaChat.
 * Returns null when no useful simplification exists.
 */
export function simplifyDishNameForLookup(name: string): string | null {
  const trimmed = name.trim();
  if (!trimmed || isFailedName(trimmed)) {
    return null;
  }

  let simplified = trimmed
    .replace(/\([^)]*\)/g, " ")
    .replace(/\[[^\]]*\]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  // Drop brand-like leading ALL-CAPS / Latin tokens when followed by a Russian dish name
  simplified = simplified.replace(/^[A-Za-z0-9][A-Za-z0-9.&'\- ]{0,24}\s+(?=[А-Яа-яЁё])/u, "");

  const beforeComma = simplified.split(",")[0]?.trim() ?? simplified;
  if (beforeComma.length >= 3 && beforeComma.toLowerCase() !== trimmed.toLowerCase()) {
    return beforeComma;
  }

  if (simplified.length >= 3 && simplified.toLowerCase() !== trimmed.toLowerCase()) {
    return simplified;
  }

  return null;
}

function pickMacro(
  visionValue: number | undefined,
  lookedValue: number | undefined,
): number | undefined {
  if (visionValue !== undefined && visionValue > 0) {
    return visionValue;
  }
  return lookedValue;
}

/** Keep explicit zeros from vision (e.g. meat has 0 fiber); only fill when missing. */
function pickOptionalMacro(
  visionValue: number | undefined,
  lookedValue: number | undefined,
): number | undefined {
  if (visionValue !== undefined) {
    return visionValue;
  }
  return lookedValue;
}

/**
 * Fill missing calories/macros from a lookup result, scaling to the vision portion
 * when the model estimated grams but left nutrition empty.
 */
export function mergeNutritionBackfill(
  vision: FoodRecognitionResult,
  looked: FoodRecognitionResult,
): FoodRecognitionResult {
  const targetGrams =
    vision.portionGrams && vision.portionGrams > 0
      ? vision.portionGrams
      : looked.portionGrams && looked.portionGrams > 0
        ? looked.portionGrams
        : undefined;

  let lookedCalories = looked.calories;
  let lookedProtein = looked.protein;
  let lookedFat = looked.fat;
  let lookedCarbs = looked.carbs;
  let lookedFiber = looked.fiber;
  let lookedSugar = looked.sugar;

  if (
    targetGrams &&
    looked.portionGrams &&
    looked.portionGrams > 0 &&
    looked.calories > 0 &&
    Math.abs(targetGrams - looked.portionGrams) >= 1
  ) {
    const ratio = targetGrams / looked.portionGrams;
    lookedCalories = Math.max(0, Math.round(looked.calories * ratio));
    lookedProtein =
      looked.protein !== undefined
        ? Math.round(looked.protein * ratio * 10) / 10
        : undefined;
    lookedFat =
      looked.fat !== undefined ? Math.round(looked.fat * ratio * 10) / 10 : undefined;
    lookedCarbs =
      looked.carbs !== undefined ? Math.round(looked.carbs * ratio * 10) / 10 : undefined;
    lookedFiber =
      looked.fiber !== undefined ? Math.round(looked.fiber * ratio * 10) / 10 : undefined;
    lookedSugar =
      looked.sugar !== undefined ? Math.round(looked.sugar * ratio * 10) / 10 : undefined;
  }

  const calories =
    vision.calories > 0 ? vision.calories : Math.max(0, Math.round(lookedCalories || 0));

  return {
    ...vision,
    calories,
    protein: pickMacro(vision.protein, lookedProtein),
    fat: pickMacro(vision.fat, lookedFat),
    carbs: pickMacro(vision.carbs, lookedCarbs),
    fiber: pickOptionalMacro(vision.fiber, lookedFiber),
    sugar: pickOptionalMacro(vision.sugar, lookedSugar),
    portionGrams: targetGrams ?? vision.portionGrams ?? looked.portionGrams,
    brand: vision.brand ?? looked.brand,
    barcode: vision.barcode ?? looked.barcode,
    imageUrl: vision.imageUrl ?? looked.imageUrl,
    source: hasUsableCalories(looked) ? looked.source ?? vision.source : vision.source,
    confidence: Math.max(looked.confidence, vision.confidence * 0.85),
  };
}

type Per100gValues = {
  calories: number;
  protein?: number;
  fat?: number;
  carbs?: number;
  fiber?: number;
  sugar?: number;
};

/** GigaChat often returns per-100 g/ml values while portionGrams is the full bottle or plate. */
export function inferPer100gValues(
  result: Pick<FoodRecognitionResult, "per100g" | "protein" | "fat" | "carbs" | "fiber" | "sugar">,
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
      fiber: result.fiber,
      sugar: result.sugar,
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
    fiber: scaleMacro(per100g.fiber, ratio),
    sugar: scaleMacro(per100g.sugar, ratio),
    portionGrams: grams,
  };
}

export function normalizeRecognitionNutrition(result: FoodRecognitionResult): FoodRecognitionResult {
  let calories = result.calories;
  let protein = result.protein;
  let fat = result.fat;
  let carbs = result.carbs;
  let fiber = result.fiber;
  let sugar = result.sugar;
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
      fiber = scaled.fiber;
      sugar = scaled.sugar;
    }
  }

  return {
    ...result,
    calories: Math.max(0, Math.round(calories)),
    protein,
    fat,
    carbs,
    fiber,
    sugar,
    portionGrams,
  };
}
