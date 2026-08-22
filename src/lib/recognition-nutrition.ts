import type { FoodRecognitionResult } from "./food-types";
import { nutritionBaseline, type NutritionValues } from "./nutrition";

const DEFAULT_MEAL_PORTION_GRAMS = 250;
const DEFAULT_PORTION_GRAMS = 100;
const PER100G_MAX_CALORIES = 120;
const LOW_DENSITY_KCAL_PER_GRAM = 0.25;
const MEAT_LIKE_DISH_RE =
  /(куриц|говяд|свин|индейк|баран|телят|стейк|филе|ветчин|бекон|колбас|сосиск|яйц|рыб|лосос|форел|тунец|треск|кревет|кальмар|творог|сыр(?!\s*оп)|масло|сметан)/iu;

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

/**
 * Vision already returned usable calories + macros — skip GigaChat/OFF backfill
 * to save tokens on multi-item plates (zeros count as provided).
 */
export function hasSufficientVisionNutrition(result: FoodRecognitionResult): boolean {
  if (isFailedName(result.dishName)) {
    return false;
  }
  if (!(result.calories > 0)) {
    return false;
  }
  const definedMacros = [result.protein, result.fat, result.carbs].filter(
    (value) => value !== undefined && Number.isFinite(value),
  ).length;
  return definedMacros >= 2;
}

/** Vision + portion complete and no fiber/sugar gap — skip all post-vision enrichment. */
export function hasCompleteVisionNutrition(result: FoodRecognitionResult): boolean {
  if (!hasSufficientVisionNutrition(result)) {
    return false;
  }
  if (!(result.portionGrams && result.portionGrams > 0)) {
    return false;
  }
  return !needsFiberSugarBackfill(result);
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

/** Treat model 0/0 fiber+sugar on carb-heavy foods as unknown so backfill can run. */
export function clearSuspiciousZeroFiberSugar(
  result: FoodRecognitionResult,
): FoodRecognitionResult {
  const carbs = result.carbs ?? 0;
  if (result.fiber === 0 && result.sugar === 0 && carbs >= 8) {
    if (MEAT_LIKE_DISH_RE.test(result.dishName)) {
      return result;
    }
    return { ...result, fiber: undefined, sugar: undefined };
  }
  return result;
}

/** True when fiber and/or sugar were omitted (empty confirm fields). */
export function needsFiberSugarBackfill(
  result: Pick<FoodRecognitionResult, "fiber" | "sugar" | "carbs">,
): boolean {
  if (result.fiber === undefined || result.sugar === undefined) {
    return true;
  }
  const carbs = result.carbs ?? 0;
  return result.fiber === 0 && result.sugar === 0 && carbs >= 8;
}

/**
 * Fill only missing fiber/sugar from another lookup, scaling to base portion.
 * Keeps explicit zeros (e.g. meat) and never overwrites existing values.
 */
export function mergeFiberSugarBackfill(
  base: FoodRecognitionResult,
  looked: FoodRecognitionResult,
): FoodRecognitionResult {
  if (!needsFiberSugarBackfill(base)) {
    return base;
  }

  let lookedFiber = looked.fiber;
  let lookedSugar = looked.sugar;
  const baseGrams = base.portionGrams;
  const lookedGrams = looked.portionGrams;

  if (
    baseGrams &&
    lookedGrams &&
    baseGrams > 0 &&
    lookedGrams > 0 &&
    Math.abs(baseGrams - lookedGrams) >= 1
  ) {
    const ratio = baseGrams / lookedGrams;
    lookedFiber =
      lookedFiber !== undefined ? Math.round(lookedFiber * ratio * 10) / 10 : undefined;
    lookedSugar =
      lookedSugar !== undefined ? Math.round(lookedSugar * ratio * 10) / 10 : undefined;
  }

  return {
    ...base,
    fiber: base.fiber !== undefined ? base.fiber : lookedFiber,
    sugar: base.sugar !== undefined ? base.sugar : lookedSugar,
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

/** Labels often expose 159 kJ/100ml — models sometimes put kJ into calories. */
export function normalizePer100gEnergy(
  per100g: Per100gValues | undefined,
): Per100gValues | undefined {
  if (!per100g || !(per100g.calories > 0)) {
    return undefined;
  }

  let calories = per100g.calories;
  // Typical drink labels: 150–400 kJ/100ml (≈36–96 kcal). Cottage cheese ~121 kcal stays.
  if (calories >= 150 && calories <= 500) {
    calories = Math.round((calories / 4.184) * 10) / 10;
  }

  return { ...per100g, calories };
}

function isPackagedPhoto(result: Pick<FoodRecognitionResult, "photoKind" | "source">): boolean {
  return (
    result.photoKind === "label" ||
    result.photoKind === "barcode" ||
    result.photoKind === "package" ||
    result.source === "label" ||
    result.source === "openfoodfacts-barcode" ||
    result.source === "openfoodfacts-search"
  );
}

/** Resolve per-100 g/ml values for portion chip scaling. */
export function resolvePer100gForScaling(
  result: Pick<
    FoodRecognitionResult,
    "calories" | "protein" | "fat" | "carbs" | "fiber" | "sugar" | "portionGrams" | "per100g" | "photoKind" | "source"
  >,
): Per100gValues | null {
  const normalized = normalizePer100gEnergy(result.per100g);
  if (normalized && normalized.calories > 0) {
    return normalized;
  }

  const portionGrams =
    result.portionGrams && result.portionGrams > 0 ? result.portionGrams : DEFAULT_PORTION_GRAMS;

  const inferred = inferPer100gValues(result, result.calories, portionGrams);
  if (inferred) {
    return inferred;
  }

  if (isPackagedPhoto(result) && portionGrams > 100 && result.calories > 0) {
    const per100Cal = Math.round((result.calories * 100) / portionGrams);
    if (per100Cal > 0 && per100Cal <= PER100G_MAX_CALORIES) {
      const ratio = 100 / portionGrams;
      return {
        calories: per100Cal,
        protein: scaleMacro(result.protein, ratio),
        fat: scaleMacro(result.fat, ratio),
        carbs: scaleMacro(result.carbs, ratio),
        fiber: scaleMacro(result.fiber, ratio),
        sugar: scaleMacro(result.sugar, ratio),
      };
    }
  }

  return null;
}

/** GigaChat often returns per-100 g/ml values while portionGrams is the full bottle or plate. */
export function inferPer100gValues(
  result: Pick<FoodRecognitionResult, "per100g" | "protein" | "fat" | "carbs" | "fiber" | "sugar">,
  calories: number,
  portionGrams: number,
): Per100gValues | null {
  if (result.per100g && result.per100g.calories > 0) {
    return normalizePer100gEnergy(result.per100g) ?? result.per100g;
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

const PER100G_REFERENCE_GRAMS = 100;

/**
 * Baseline for portion chip scaling. When label data is per 100 g/ml, anchor at 100
 * so 38 kcal/100ml × 1500ml → 570 kcal (not 38×1500/700 ≈ 81).
 */
export function nutritionBaselineFromRecognition(
  result: Pick<
    FoodRecognitionResult,
    "calories" | "protein" | "fat" | "carbs" | "fiber" | "sugar" | "portionGrams" | "per100g" | "photoKind" | "source"
  >,
): NutritionValues | null {
  const per100 = resolvePer100gForScaling(result);
  if (per100) {
    return nutritionBaseline({
      calories: per100.calories,
      protein: per100.protein,
      fat: per100.fat,
      carbs: per100.carbs,
      fiber: per100.fiber,
      sugar: per100.sugar,
      portionGrams: PER100G_REFERENCE_GRAMS,
    });
  }

  const portionGrams =
    result.portionGrams && result.portionGrams > 0 ? result.portionGrams : PER100G_REFERENCE_GRAMS;

  return nutritionBaseline({
    calories: result.calories,
    protein: result.protein,
    fat: result.fat,
    carbs: result.carbs,
    fiber: result.fiber,
    sugar: result.sugar,
    portionGrams,
  });
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
  let per100g = normalizePer100gEnergy(result.per100g);

  if (!portionGrams || portionGrams <= 0) {
    portionGrams =
      result.photoKind === "meal" ? DEFAULT_MEAL_PORTION_GRAMS : DEFAULT_PORTION_GRAMS;
  }

  const per100gSource = resolvePer100gForScaling({ ...result, per100g, portionGrams });
  if (per100gSource) {
    per100g = per100gSource;
    const scaled = scaleFromPer100g(per100gSource, portionGrams);
    if (scaled) {
      calories = scaled.calories;
      // per100g often omits fiber/sugar (and sometimes a macro). Never wipe values
      // already filled on the portion (e.g. OFF/GigaChat enrich after vision).
      protein = scaled.protein !== undefined ? scaled.protein : protein;
      fat = scaled.fat !== undefined ? scaled.fat : fat;
      carbs = scaled.carbs !== undefined ? scaled.carbs : carbs;
      fiber = scaled.fiber !== undefined ? scaled.fiber : fiber;
      sugar = scaled.sugar !== undefined ? scaled.sugar : sugar;
    }
  }

  return clearSuspiciousZeroFiberSugar({
    ...result,
    per100g,
    calories: Math.max(0, Math.round(calories)),
    protein,
    fat,
    carbs,
    fiber,
    sugar,
    portionGrams,
  });
}
