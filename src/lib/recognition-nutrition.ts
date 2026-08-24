import type { FoodRecognitionResult } from "./food-types";
import { inferDrinkPackMlFromText, looksLikeDrinkName } from "./portion-unit";
import { nutritionBaseline, scaleNutritionByPortion, type NutritionValues } from "./nutrition";

const DEFAULT_MEAL_PORTION_GRAMS = 250;
const DEFAULT_PORTION_GRAMS = 100;
const PER100G_REFERENCE_GRAMS = 100;
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

/** Labels/packages with calorie totals — skip slow GigaChat macro/fiber backfill in SSE phase. */
export function shouldSkipSlowPostVisionEnrichment(
  result: Pick<FoodRecognitionResult, "photoKind" | "source" | "calories">,
): boolean {
  const packaged =
    result.photoKind === "label" ||
    result.photoKind === "package" ||
    result.photoKind === "barcode" ||
    result.source === "label" ||
    result.source === "openfoodfacts-barcode" ||
    result.source === "openfoodfacts-search" ||
    result.source === "gigachat-barcode";

  return packaged && Number.isFinite(result.calories) && result.calories > 0;
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
function convertLabelEnergyKjToKcal(
  calories: number,
  macros?: Pick<Per100gValues, "protein" | "fat" | "carbs">,
): number {
  // Typical drink labels: 150–400 kJ/100ml (≈36–96 kcal). Cottage cheese ~121 kcal stays.
  if (calories < 150 || calories > 500) {
    return calories;
  }

  // Dense foods (bars, cheese, nuts): 200–500 is already kcal/100g, not kJ.
  if (
    (macros?.fat !== undefined && macros.fat > 8) ||
    (macros?.protein !== undefined && macros.protein > 10) ||
    (macros?.carbs !== undefined && macros.carbs > 20)
  ) {
    return calories;
  }

  return Math.round((calories / 4.184) * 10) / 10;
}

export function normalizePer100gEnergy(
  per100g: Per100gValues | undefined,
): Per100gValues | undefined {
  if (!per100g || !(per100g.calories > 0)) {
    return undefined;
  }

  return {
    ...per100g,
    calories: convertLabelEnergyKjToKcal(per100g.calories, per100g),
  };
}

/** Vision sometimes puts kJ/100 ml into the top-level calories field (e.g. 150 instead of 38). */
export function normalizeTopLevelEnergyCalories(
  calories: number,
  portionGrams?: number | null,
): number {
  if (calories < 150 || calories > 500) {
    return calories;
  }

  // Dense snack pack totals (225 kcal @ 50 g ≈ 4.5 kcal/g) are not kJ.
  if (portionGrams && portionGrams > 0 && portionGrams <= 100) {
    const density = calories / portionGrams;
    if (density >= 2.5) {
      return calories;
    }
  }

  const converted = convertLabelEnergyKjToKcal(calories);

  // Portion totals like 190 kcal @ 500 ml must not be treated as 190 kJ → 45 kcal.
  if (portionGrams && portionGrams > 100) {
    const per100FromRaw = (calories * 100) / portionGrams;
    if (per100FromRaw >= 20 && per100FromRaw <= 65) {
      return calories;
    }
    const per100FromConverted = (converted * 100) / portionGrams;
    if (per100FromConverted >= 20 && per100FromConverted <= 65) {
      return converted;
    }
  }

  if (caloriesLookPer100g(converted)) {
    return converted;
  }

  return calories;
}

function isTrustedPackDbSource(source: FoodRecognitionResult["source"] | undefined): boolean {
  return (
    source === "openfoodfacts-barcode" ||
    source === "openfoodfacts-search" ||
    source === "ru-nutrition-table"
  );
}

/**
 * Label vision often reads «38 ккал / 100 мл» into calories but leaves per100g at zero.
 * Copy explicit per-100 values so scaling always uses the table row from the label.
 */
export function coalesceLabelPer100FromVision(result: FoodRecognitionResult): FoodRecognitionResult {
  const isLabelLike =
    result.photoKind === "label" ||
    result.photoKind === "package" ||
    isPackagedPhoto(result);

  if (!isLabelLike && !looksLikeDrinkName(result.dishName)) {
    return result;
  }

  const existing = normalizePer100gEnergy(result.per100g);
  if (existing && existing.calories > 0) {
    return { ...result, per100g: existing };
  }

  // OFF / RU table already returned portion totals. Don't invent density from pack kcal
  // (225 kcal @ 50 g must not become fake 53.8 kcal/100g via kJ heuristic).
  if (
    isTrustedPackDbSource(result.source) &&
    result.portionGrams &&
    result.portionGrams > 0 &&
    result.portionGrams !== 100
  ) {
    return result;
  }

  const portion = result.portionGrams && result.portionGrams > 0 ? result.portionGrams : undefined;
  const topCal = normalizeTopLevelEnergyCalories(result.calories, portion);

  if (!caloriesLookPer100g(topCal)) {
    return result;
  }

  return {
    ...result,
    per100g: {
      calories: topCal,
      protein: result.protein,
      fat: result.fat,
      carbs: result.carbs,
      fiber: result.fiber,
      sugar: result.sugar,
    },
  };
}

function isPackagedPhoto(result: Pick<FoodRecognitionResult, "photoKind" | "source">): boolean {
  return (
    result.photoKind === "label" ||
    result.photoKind === "barcode" ||
    result.photoKind === "package" ||
    result.source === "label" ||
    result.source === "openfoodfacts-barcode" ||
    result.source === "openfoodfacts-search" ||
    result.source === "gigachat-barcode"
  );
}

function caloriesLookPer100g(calories: number): boolean {
  return calories > 0 && calories <= PER100G_MAX_CALORIES;
}

/** Resolve per-100 g/ml values for portion chip scaling. */
export function resolvePer100gForScaling(
  result: Pick<
    FoodRecognitionResult,
    | "calories"
    | "protein"
    | "fat"
    | "carbs"
    | "fiber"
    | "sugar"
    | "portionGrams"
    | "per100g"
    | "photoKind"
    | "source"
  > & { dishName?: string },
): Per100gValues | null {
  const normalized = normalizePer100gEnergy(result.per100g);
  if (normalized && normalized.calories > 0) {
    return normalized;
  }

  const explicitPortion =
    result.portionGrams && result.portionGrams > 0 ? result.portionGrams : null;
  const portionGrams = explicitPortion ?? DEFAULT_PORTION_GRAMS;
  const topLevelCalories = normalizeTopLevelEnergyCalories(result.calories, portionGrams);

  // Label rows and drinks: models often put kcal/100 ml (or kJ/100 ml) in calories while portionGrams is pack volume.
  const looksPer100Portion =
    portionGrams > 100 ||
    !explicitPortion ||
    (explicitPortion === PER100G_REFERENCE_GRAMS && caloriesLookPer100g(topLevelCalories));

  if (
    caloriesLookPer100g(topLevelCalories) &&
    (isPackagedPhoto(result) || looksLikeDrinkName(result.dishName)) &&
    looksPer100Portion
  ) {
    return {
      calories: topLevelCalories,
      protein: result.protein,
      fat: result.fat,
      carbs: result.carbs,
      fiber: result.fiber,
      sugar: result.sugar,
    };
  }

  const inferred = inferPer100gValues(result, topLevelCalories, portionGrams);
  if (inferred) {
    return inferred;
  }

  if (
    (isPackagedPhoto(result) || looksLikeDrinkName(result.dishName)) &&
    portionGrams > 100 &&
    result.calories > PER100G_MAX_CALORIES
  ) {
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

/**
 * Baseline for portion chip scaling. When label data is per 100 g/ml, anchor at 100
 * so 38 kcal/100ml × 1500ml → 570 kcal (not 38×1500/700 ≈ 81).
 */
export function nutritionBaselineFromRecognition(
  result: Pick<
    FoodRecognitionResult,
    "calories" | "protein" | "fat" | "carbs" | "fiber" | "sugar" | "portionGrams" | "per100g" | "photoKind" | "source"
  > & { dishName?: string },
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
  const coalesced = coalesceLabelPer100FromVision(result);
  let calories = coalesced.calories;
  let protein = coalesced.protein;
  let fat = coalesced.fat;
  let carbs = coalesced.carbs;
  let fiber = coalesced.fiber;
  let sugar = coalesced.sugar;
  let portionGrams = coalesced.portionGrams;
  let per100g = normalizePer100gEnergy(coalesced.per100g);

  if (!portionGrams || portionGrams <= 0) {
    portionGrams =
      result.photoKind === "meal" ? DEFAULT_MEAL_PORTION_GRAMS : DEFAULT_PORTION_GRAMS;
  }

  const resolvedPortion = resolveDisplayPortionGrams({ ...coalesced, portionGrams, per100g });
  if (resolvedPortion && resolvedPortion !== portionGrams) {
    portionGrams = resolvedPortion;
  }

  const per100gSource = resolvePer100gForScaling({ ...coalesced, per100g, portionGrams });
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
    ...coalesced,
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

/** Resolve portion shown on confirm card (bottle ml from label text when vision omits volume). */
export function resolveDisplayPortionGrams(
  item: Pick<
    FoodRecognitionResult,
    "dishName" | "brand" | "portionGrams" | "calories" | "photoKind" | "source" | "per100g"
  >,
): number | undefined {
  const explicit = item.portionGrams && item.portionGrams > 0 ? item.portionGrams : undefined;
  const fromText = inferDrinkPackMlFromText(item.dishName, item.brand);

  if (fromText && explicit) {
    return Math.max(explicit, fromText);
  }

  if (explicit && explicit > 100) {
    return explicit;
  }

  if (fromText) {
    return fromText;
  }

  return explicit;
}

/** Human-readable hint: per-100 vs pack portion (confirm card). */
export function describeNutritionBasis(
  item: Pick<
    FoodRecognitionResult,
    "dishName" | "brand" | "portionGrams" | "calories" | "photoKind" | "source" | "per100g"
  >,
): string | null {
  const per100 = resolvePer100gForScaling(item);
  const portion = resolveDisplayPortionGrams(item);
  const drink = looksLikeDrinkName(item.dishName, item.brand);
  const unit = drink ? "мл" : "г";

  if (item.photoKind === "label" && per100) {
    if (portion && portion !== PER100G_REFERENCE_GRAMS) {
      return `На этикетке: ${Math.round(per100.calories)} ккал / 100 ${unit} → на порцию ${portion} ${unit}`;
    }
    return `На этикетке: ${Math.round(per100.calories)} ккал / 100 ${unit}`;
  }

  if (per100 && portion && portion > 0 && portion !== PER100G_REFERENCE_GRAMS) {
    return `${Math.round(per100.calories)} ккал / 100 ${unit} → ${Math.round(item.calories)} ккал на ${portion} ${unit}`;
  }

  if (per100 && (!portion || portion === PER100G_REFERENCE_GRAMS)) {
    return `КБЖУ на 100 ${unit}`;
  }

  if (portion && portion > 0 && !per100) {
    return `Калории на порцию ${portion} ${unit}`;
  }

  return null;
}

/** Scale vision/label nutrition to a portion for confirm-card display and save. */
export function scaleRecognitionToPortion(
  item: Pick<
    FoodRecognitionResult,
    | "dishName"
    | "calories"
    | "protein"
    | "fat"
    | "carbs"
    | "fiber"
    | "sugar"
    | "portionGrams"
    | "per100g"
    | "photoKind"
    | "source"
  >,
  portionGrams: number,
): Pick<
  FoodRecognitionResult,
  "calories" | "protein" | "fat" | "carbs" | "fiber" | "sugar" | "portionGrams"
> {
  if (!Number.isFinite(portionGrams) || portionGrams <= 0) {
    return {
      calories: item.calories,
      protein: item.protein,
      fat: item.fat,
      carbs: item.carbs,
      fiber: item.fiber,
      sugar: item.sugar,
      portionGrams: item.portionGrams,
    };
  }

  const per100 = resolvePer100gForScaling(item);
  if (per100) {
    const scaled = scaleFromPer100g(per100, portionGrams);
    if (scaled) {
      return {
        calories: scaled.calories,
        protein: scaled.protein ?? item.protein,
        fat: scaled.fat ?? item.fat,
        carbs: scaled.carbs ?? item.carbs,
        fiber: scaled.fiber ?? item.fiber,
        sugar: scaled.sugar ?? item.sugar,
        portionGrams: scaled.portionGrams,
      };
    }
  }

  const baseline = nutritionBaselineFromRecognition(item);
  if (baseline) {
    const scaled = scaleNutritionByPortion(baseline, portionGrams);
    if (scaled) {
      return {
        calories: scaled.calories,
        protein: scaled.protein,
        fat: scaled.fat,
        carbs: scaled.carbs,
        fiber: scaled.fiber,
        sugar: scaled.sugar,
        portionGrams: scaled.portionGrams,
      };
    }
  }

  return {
    calories: item.calories,
    protein: item.protein,
    fat: item.fat,
    carbs: item.carbs,
    fiber: item.fiber,
    sugar: item.sugar,
    portionGrams,
  };
}

/**
 * Scale to the confirm-card portion and force per-100 → pack math when the first pass
 * still looks like kcal/100 ml on a large bottle (common on raw SSE vision payloads).
 */
export function scaleRecognitionToDisplayPortion(
  item: Pick<
    FoodRecognitionResult,
    | "dishName"
    | "calories"
    | "protein"
    | "fat"
    | "carbs"
    | "fiber"
    | "sugar"
    | "portionGrams"
    | "per100g"
    | "photoKind"
    | "source"
    | "brand"
  >,
  portionGrams: number,
): Pick<
  FoodRecognitionResult,
  "calories" | "protein" | "fat" | "carbs" | "fiber" | "sugar" | "portionGrams"
> {
  const scaled = scaleRecognitionToPortion(item, portionGrams);
  const per100 = resolvePer100gForScaling(item);
  if (!per100 || portionGrams <= 100) {
    return scaled;
  }

  const expectedCal = Math.round((per100.calories * portionGrams) / 100);
  if (scaled.calories >= expectedCal * 0.85) {
    return scaled;
  }

  const forced = scaleFromPer100g(per100, portionGrams);
  if (!forced) {
    return scaled;
  }

  return {
    calories: forced.calories,
    protein: forced.protein ?? scaled.protein ?? item.protein,
    fat: forced.fat ?? scaled.fat ?? item.fat,
    carbs: forced.carbs ?? scaled.carbs ?? item.carbs,
    fiber: forced.fiber ?? scaled.fiber ?? item.fiber,
    sugar: forced.sugar ?? scaled.sugar ?? item.sugar,
    portionGrams,
  };
}

/** True when calories look like per-100 g/ml but the portion is a full bottle or pack. */
export function recognitionNeedsPortionRescale(
  item: Pick<
    FoodRecognitionResult,
    "calories" | "portionGrams" | "per100g" | "photoKind" | "source"
  > & { dishName?: string },
  displayedCalories?: number,
): boolean {
  const per100 = resolvePer100gForScaling(item);
  if (!per100) {
    return false;
  }

  const portion = item.portionGrams && item.portionGrams > 0 ? item.portionGrams : 0;
  if (portion <= 100) {
    return false;
  }

  const expected = Math.round((per100.calories * portion) / 100);
  const current = displayedCalories ?? item.calories;
  if (!Number.isFinite(current) || current <= 0) {
    return true;
  }

  if (current <= 120 && expected > current + 10) {
    return true;
  }

  // Catch under-scaled bottle totals that match a wrong reverse-inferred per100 (e.g. 150 kcal @ 1500 ml beer).
  return expected > current + 10 && current < expected * 0.85;
}

/** Merge name lookup into confirm card while keeping the user's portion and label totals. */
export function applyFoodLookupToPortion(
  current: FoodRecognitionResult,
  looked: Pick<
    FoodRecognitionResult,
    | "dishName"
    | "calories"
    | "protein"
    | "fat"
    | "carbs"
    | "fiber"
    | "sugar"
    | "portionGrams"
    | "source"
  >,
  targetPortionGrams: number,
): Pick<
  FoodRecognitionResult,
  "dishName" | "calories" | "protein" | "fat" | "carbs" | "fiber" | "sugar" | "portionGrams"
> {
  const portion =
    Number.isFinite(targetPortionGrams) && targetPortionGrams > 0
      ? targetPortionGrams
      : looked.portionGrams && looked.portionGrams > 0
        ? looked.portionGrams
        : current.portionGrams ?? DEFAULT_PORTION_GRAMS;

  const scaledCurrent = scaleRecognitionToPortion(current, portion);
  const scaledLooked = scaleRecognitionToPortion(
    {
      ...current,
      ...looked,
      portionGrams: looked.portionGrams && looked.portionGrams > 0 ? looked.portionGrams : portion,
    },
    portion,
  );

  const fromLabel =
    current.photoKind === "label" ||
    current.source === "label" ||
    current.photoKind === "package" ||
    current.photoKind === "barcode";

  const calories =
    fromLabel &&
    scaledCurrent.calories > 0 &&
    scaledLooked.calories > 0 &&
    scaledCurrent.calories > scaledLooked.calories * 1.25
      ? scaledCurrent.calories
      : scaledLooked.calories > 0
        ? scaledLooked.calories
        : scaledCurrent.calories;

  return {
    dishName: looked.dishName.trim() || current.dishName,
    calories,
    protein: pickMacro(scaledCurrent.protein, scaledLooked.protein),
    fat: pickMacro(scaledCurrent.fat, scaledLooked.fat),
    carbs: pickMacro(scaledCurrent.carbs, scaledLooked.carbs),
    fiber: pickOptionalMacro(scaledCurrent.fiber, scaledLooked.fiber),
    sugar: pickOptionalMacro(scaledCurrent.sugar, scaledLooked.sugar),
    portionGrams: portion,
  };
}

/** Scale a vision alternative to the portion already chosen on the confirm card. */
export function applyAlternativeToPortion(
  context: Pick<
    FoodRecognitionResult,
    "dishName" | "photoKind" | "source" | "portionGrams" | "per100g" | "brand"
  >,
  alternative: Pick<
    FoodRecognitionResult,
    | "dishName"
    | "calories"
    | "protein"
    | "fat"
    | "carbs"
    | "fiber"
    | "sugar"
    | "portionGrams"
  >,
  targetPortionGrams: number,
): Pick<
  FoodRecognitionResult,
  "dishName" | "calories" | "protein" | "fat" | "carbs" | "fiber" | "sugar" | "portionGrams"
> {
  const portion =
    Number.isFinite(targetPortionGrams) && targetPortionGrams > 0
      ? targetPortionGrams
      : context.portionGrams && context.portionGrams > 0
        ? context.portionGrams
        : DEFAULT_PORTION_GRAMS;

  const scaled = scaleRecognitionToPortion(
    {
      ...context,
      dishName: alternative.dishName,
      calories: alternative.calories,
      protein: alternative.protein,
      fat: alternative.fat,
      carbs: alternative.carbs,
      fiber: alternative.fiber,
      sugar: alternative.sugar,
      portionGrams:
        alternative.portionGrams && alternative.portionGrams > 0
          ? alternative.portionGrams
          : context.portionGrams,
    },
    portion,
  );

  return {
    dishName: alternative.dishName.trim() || context.dishName,
    calories: scaled.calories,
    protein: scaled.protein,
    fat: scaled.fat,
    carbs: scaled.carbs,
    fiber: scaled.fiber,
    sugar: scaled.sugar,
    portionGrams: portion,
  };
}
