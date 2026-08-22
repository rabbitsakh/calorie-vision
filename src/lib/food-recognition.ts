import type { FoodRecognitionResult, PhotoKind } from "@/lib/food-types";
import { lookupFiberSugarWithGigaChat, lookupFiberSugarBatchWithGigaChat, lookupFoodWithGigaChat, recognizeWithGigaChat } from "@/lib/ai/gigachat";
import type { VisionPromptHints } from "@/lib/ai/prompt-variants";
import { logRecognitionPass } from "@/lib/ai/recognition-telemetry";
import { mapPool, withTimeoutFallback } from "@/lib/async-pool";
import { normalizeBarcode } from "@/lib/barcode";
import {
  applyStoredFoodCorrection,
  lookupStoredFoodCorrection,
} from "@/lib/food-corrections-store";
import { findFoodImage } from "@/lib/food-image";
import { lookupFiberSugarTable } from "@/lib/fiber-sugar-table";
import { enrichAlternativesFromRuTable } from "@/lib/recognition-alternatives";
import { lookupQueriesForName } from "@/lib/dish-lookup-synonyms";
import {
  combineRecognitionItems,
  isMultiItemRecognition,
} from "@/lib/recognition-items";
import {
  hasCompleteVisionNutrition,
  hasUsableCalories,
  hasSufficientVisionNutrition,
  mergeFiberSugarBackfill,
  mergeNutritionBackfill,
  needsFiberSugarBackfill,
  needsNutritionLookup,
  normalizePer100gEnergy,
  normalizeRecognitionNutrition,
  simplifyDishNameForLookup,
} from "@/lib/recognition-nutrition";
import { lookupRuNutritionTable } from "@/lib/ru-nutrition-lookup";
import {
  lookupOpenFoodFactsByBarcodeWithRepair,
  nutritionFromPer100g,
  offMatchesQuery,
  searchOpenFoodFacts,
  searchOpenFoodFactsBest,
  type PackNutrition,
} from "@/lib/open-food-facts";

export type { FoodRecognitionResult, PhotoKind } from "@/lib/food-types";
export { RECOGNITION_SOURCE_LABELS } from "@/lib/food-types";

/** Wall-clock budget for post-vision OFF/GigaChat enrichment (nginx is ~180s total). */
const POST_VISION_BUDGET_MS = 60_000;
const PLATE_ENRICH_CONCURRENCY = 3;
const BACKFILL_LOOKUP_MAX = 2;
/** Barcode path: short fiber/sugar ask only — keep /api/food/lookup under proxy limits. */
const BARCODE_FIBER_SUGAR_MS = 10_000;

function isFailedName(name: string): boolean {
  return /не удалось распознать/i.test(name);
}

function hasMacros(result: FoodRecognitionResult): boolean {
  return (
    result.calories > 0 &&
    [result.protein, result.fat, result.carbs].filter((value) => value !== undefined).length >= 2
  );
}

export function nutritionFromLabel(vision: FoodRecognitionResult): FoodRecognitionResult {
  const per100g = normalizePer100gEnergy(vision.per100g);
  const grams = vision.portionGrams && vision.portionGrams > 0 ? vision.portionGrams : 100;
  if (per100g && per100g.calories > 0) {
    const scaled = nutritionFromPer100g(per100g, grams);
    if (scaled) {
      return {
        ...vision,
        per100g,
        calories: scaled.calories,
        protein: scaled.protein,
        fat: scaled.fat,
        carbs: scaled.carbs,
        fiber: scaled.fiber,
        sugar: scaled.sugar,
        portionGrams: scaled.portionGrams,
        photoKind: "label",
        source: "label",
        confidence: Math.max(vision.confidence, 0.8),
      };
    }
  }

  return {
    ...vision,
    per100g,
    photoKind: "label",
    source: "label",
    confidence: Math.max(vision.confidence, 0.75),
  };
}

function pickPortionGrams(
  vision: FoodRecognitionResult,
  off: PackNutrition,
): number {
  if (off.explicitPackGrams) {
    const pack = off.packGrams ?? off.portionGrams;
    if (pack > 0) {
      return pack;
    }
  }

  const visionGrams = vision.portionGrams;
  if (
    visionGrams !== undefined &&
    visionGrams > 0 &&
    visionGrams <= 500 &&
    visionGrams !== 100
  ) {
    return visionGrams;
  }

  return off.packGrams ?? off.portionGrams;
}

function mergeOffNutrition(
  vision: FoodRecognitionResult,
  off: PackNutrition,
  source: "openfoodfacts-barcode" | "openfoodfacts-search",
  barcode?: string | null,
): FoodRecognitionResult {
  const preferredGrams = pickPortionGrams(vision, off);
  const scaled =
    preferredGrams !== off.portionGrams && off.calories > 0 && off.portionGrams > 0
      ? nutritionFromPer100g(
          {
            calories: (off.calories / off.portionGrams) * 100,
            protein: off.protein !== undefined ? (off.protein / off.portionGrams) * 100 : undefined,
            fat: off.fat !== undefined ? (off.fat / off.portionGrams) * 100 : undefined,
            carbs: off.carbs !== undefined ? (off.carbs / off.portionGrams) * 100 : undefined,
            fiber: off.fiber !== undefined ? (off.fiber / off.portionGrams) * 100 : undefined,
            sugar: off.sugar !== undefined ? (off.sugar / off.portionGrams) * 100 : undefined,
          },
          preferredGrams,
        )
      : off;

  const fallbackKind: PhotoKind = source === "openfoodfacts-barcode" ? "barcode" : "package";
  const photoKind = vision.photoKind === "meal" ? fallbackKind : vision.photoKind ?? fallbackKind;
  const portionForPer100 = scaled?.portionGrams ?? off.portionGrams;
  const per100Calories =
    portionForPer100 > 0
      ? Math.round(((scaled?.calories ?? off.calories) / portionForPer100) * 100)
      : 0;

  return {
    ...vision,
    dishName: off.dishName || vision.dishName,
    calories: scaled?.calories ?? off.calories,
    protein: scaled?.protein ?? off.protein,
    fat: scaled?.fat ?? off.fat,
    carbs: scaled?.carbs ?? off.carbs,
    fiber: scaled?.fiber ?? off.fiber,
    sugar: scaled?.sugar ?? off.sugar,
    portionGrams: scaled?.portionGrams ?? off.portionGrams,
    per100g:
      per100Calories > 0
        ? {
            calories: per100Calories,
            protein:
              portionForPer100 > 0 && (scaled?.protein ?? off.protein) !== undefined
                ? Math.round(((scaled?.protein ?? off.protein)! / portionForPer100) * 1000) / 10
                : undefined,
            fat:
              portionForPer100 > 0 && (scaled?.fat ?? off.fat) !== undefined
                ? Math.round(((scaled?.fat ?? off.fat)! / portionForPer100) * 1000) / 10
                : undefined,
            carbs:
              portionForPer100 > 0 && (scaled?.carbs ?? off.carbs) !== undefined
                ? Math.round(((scaled?.carbs ?? off.carbs)! / portionForPer100) * 1000) / 10
                : undefined,
            fiber:
              portionForPer100 > 0 && (scaled?.fiber ?? off.fiber) !== undefined
                ? Math.round(((scaled?.fiber ?? off.fiber)! / portionForPer100) * 1000) / 10
                : undefined,
            sugar:
              portionForPer100 > 0 && (scaled?.sugar ?? off.sugar) !== undefined
                ? Math.round(((scaled?.sugar ?? off.sugar)! / portionForPer100) * 1000) / 10
                : undefined,
          }
        : vision.per100g,
    barcode: barcode ?? off.barcode ?? vision.barcode,
    brand: off.brand ?? vision.brand,
    imageUrl: off.imageUrl ?? vision.imageUrl,
    photoKind,
    source,
    confidence: Math.max(vision.confidence, source === "openfoodfacts-barcode" ? 0.9 : 0.8),
  };
}

export async function enrichPackagedProduct(
  vision: FoodRecognitionResult,
): Promise<FoodRecognitionResult> {
  // Skip barcode lookup for plated meals: the model sometimes invents a code.
  const barcode = vision.photoKind === "meal" ? null : normalizeBarcode(vision.barcode);
  if (barcode) {
    const off = await lookupOpenFoodFactsByBarcodeWithRepair(barcode);
    if (off) {
      return mergeOffNutrition(vision, off, "openfoodfacts-barcode", barcode);
    }
  }

  if (vision.photoKind === "label" || (vision.per100g && vision.per100g.calories > 0)) {
    if (hasMacros(vision) || (vision.per100g && vision.per100g.calories > 0)) {
      return nutritionFromLabel(vision);
    }
  }

  const query = [vision.brand, vision.dishName].filter(Boolean).join(" ").trim();
  const shouldSearchPackage =
    vision.photoKind === "package" ||
    vision.photoKind === "barcode" ||
    (Boolean(vision.brand) && vision.photoKind !== "meal");

  if (shouldSearchPackage && query && !isFailedName(query)) {
    const off = await searchOpenFoodFactsBest([query, vision.dishName.trim()].filter(Boolean));
    if (off && offMatchesQuery(query, off.dishName, off.brand)) {
      return mergeOffNutrition(vision, off, "openfoodfacts-search", barcode);
    }
  }

  if (
    (vision.photoKind === "package" ||
      vision.photoKind === "barcode" ||
      vision.photoKind === "label") &&
    vision.per100g &&
    vision.per100g.calories > 0 &&
    vision.portionGrams &&
    vision.portionGrams > 0 &&
    vision.portionGrams !== 100
  ) {
    return nutritionFromLabel(vision);
  }

  return {
    ...vision,
    source: vision.source ?? "gigachat",
    photoKind: vision.photoKind ?? "meal",
  };
}

async function backfillMissingNutrition(
  result: FoodRecognitionResult,
  userId?: string | null,
  isCancelled?: () => boolean,
): Promise<FoodRecognitionResult> {
  if (!needsNutritionLookup(result)) {
    return result;
  }

  const names = lookupQueriesForName(
    result.dishName.trim(),
    simplifyDishNameForLookup(result.dishName),
    BACKFILL_LOOKUP_MAX,
  );

  let best = result;

  for (const name of names) {
    if (isCancelled?.()) {
      break;
    }
    try {
      const looked = await lookupFoodByName(name, userId);
      if (!hasUsableCalories(looked) && needsNutritionLookup(looked)) {
        continue;
      }

      const merged = normalizeRecognitionNutrition(mergeNutritionBackfill(best, looked));
      const improved =
        merged.calories > best.calories ||
        (!needsNutritionLookup(merged) && needsNutritionLookup(best));

      if (improved) {
        best = merged;
      }
      if (!needsNutritionLookup(best)) {
        break;
      }
    } catch (error) {
      console.error("Nutrition lookup fallback failed", error);
    }
  }

  return best;
}

async function runEnrichmentWithBudget(
  result: FoodRecognitionResult,
  userId: string | null | undefined,
  remainingMs: number,
  dishName: string,
  options?: { skipFiberSugar?: boolean },
): Promise<{ result: FoodRecognitionResult; timedOut: boolean }> {
  const gate = { cancelled: false };
  const enriched = await withTimeoutFallback(
    (async () => {
      let next = result;
      if (hasCompleteVisionNutrition(next)) {
        return next;
      }
      if (!hasSufficientVisionNutrition(next)) {
        next = await backfillMissingNutrition(next, userId, () => gate.cancelled);
      }
      if (!options?.skipFiberSugar && !gate.cancelled && needsFiberSugarBackfill(next)) {
        next = await enrichMissingFiberSugar(next, dishName);
      }
      return next;
    })(),
    remainingMs,
    result,
    () => {
      gate.cancelled = true;
    },
  );

  logRecognitionPass({
    pass: "enrichment",
    photoKind: enriched.photoKind,
    itemCount: enriched.items?.length ?? 0,
    calories: enriched.calories,
    confidence: enriched.confidence,
    dishName: enriched.dishName,
    source: enriched.source,
    enrichmentTimedOut: gate.cancelled,
  });

  return { result: enriched, timedOut: gate.cancelled };
}

async function enrichMealItem(
  vision: FoodRecognitionResult,
  userId?: string | null,
  deadlineMs?: number,
  options?: { deferFiberSugar?: boolean },
): Promise<FoodRecognitionResult> {
  let result = normalizeRecognitionNutrition({
    ...vision,
    photoKind: vision.photoKind ?? "meal",
    source: vision.source ?? "gigachat",
    items: undefined,
  });

  const barcode = normalizeBarcode(result.barcode);
  const packagedOnPlate =
    result.photoKind === "package" ||
    result.photoKind === "barcode" ||
    result.photoKind === "label" ||
    (barcode !== null && result.photoKind !== "meal");

  if (packagedOnPlate) {
    result = normalizeRecognitionNutrition(await enrichPackagedProduct(result));
  }

  // If the item has per100g data (e.g. a packaged snack on the plate), scale it
  if (result.per100g && result.per100g.calories > 0 && result.calories <= 0) {
    result = normalizeRecognitionNutrition(nutritionFromLabel(result));
  }

  const remaining =
    deadlineMs === undefined ? POST_VISION_BUDGET_MS : Math.max(0, deadlineMs - Date.now());
  if (remaining <= 0) {
    return applyStoredFoodCorrection(normalizeRecognitionNutrition(result), userId);
  }

  const { result: enriched, timedOut } = await runEnrichmentWithBudget(
    result,
    userId,
    remaining,
    result.dishName,
    { skipFiberSugar: options?.deferFiberSugar },
  );
  result = enriched;

  if (options?.deferFiberSugar && !timedOut && needsFiberSugarBackfill(result)) {
    // Plate batch path fills fiber/sugar after all items are processed.
    return applyStoredFoodCorrection(normalizeRecognitionNutrition(result), userId);
  }

  return applyStoredFoodCorrection(normalizeRecognitionNutrition(result), userId);
}

async function enrichPlateFiberSugarBatch(
  items: FoodRecognitionResult[],
  deadlineMs: number,
): Promise<FoodRecognitionResult[]> {
  if (!process.env.GIGACHAT_CREDENTIALS) {
    return items;
  }
  if (Date.now() >= deadlineMs) {
    return items;
  }

  const targets = items
    .map((item, index) => ({ item, index }))
    .filter(({ item }) => needsFiberSugarBackfill(item));
  if (targets.length < 2) {
    if (targets.length === 1) {
      const only = targets[0]!;
      const enriched = await enrichMissingFiberSugar(only.item, only.item.dishName);
      return items.map((item, index) => (index === only.index ? enriched : item));
    }
    return items;
  }

  try {
    const partials = await lookupFiberSugarBatchWithGigaChat(
      targets.map(({ item }) => ({
        dishName: item.dishName,
        portionGrams: item.portionGrams,
      })),
    );

    return items.map((item, index) => {
      const target = targets.find((entry) => entry.index === index);
      if (!target) {
        return item;
      }

      const partial =
        partials.find(
          (entry) => entry.dishName.trim().toLowerCase() === item.dishName.trim().toLowerCase(),
        ) ?? partials[targets.findIndex((entry) => entry.index === index)];

      if (!partial) {
        return item;
      }

      return normalizeRecognitionNutrition({
        ...item,
        fiber: item.fiber !== undefined ? item.fiber : partial.fiber,
        sugar: item.sugar !== undefined ? item.sugar : partial.sugar,
      });
    });
  } catch (error) {
    console.warn("Batch fiber/sugar enrichment failed", error);
    return items;
  }
}

function finalizeRecognitionResult(
  result: FoodRecognitionResult,
  userId?: string | null,
): Promise<FoodRecognitionResult> {
  return applyStoredFoodCorrection(
    normalizeRecognitionNutrition(enrichAlternativesFromRuTable(result)),
    userId,
  );
}

export async function enrichRecognitionAfterVision(
  vision: FoodRecognitionResult,
  userId?: string | null,
): Promise<FoodRecognitionResult> {
  const deadlineMs = Date.now() + POST_VISION_BUDGET_MS;
  const plated =
    (vision.photoKind === "meal" || vision.photoKind === undefined) && isMultiItemRecognition(vision);

  if (plated && vision.items) {
    const processed = await mapPool(vision.items, PLATE_ENRICH_CONCURRENCY, (item) =>
      enrichMealItem(item, userId, deadlineMs, { deferFiberSugar: true }),
    );
    const withFiberSugar = await enrichPlateFiberSugarBatch(processed, deadlineMs);
    return finalizeRecognitionResult(
      combineRecognitionItems(withFiberSugar, { ...vision, source: "gigachat" }),
      userId,
    );
  }

  const enriched = await enrichPackagedProduct({ ...vision, source: "gigachat", items: undefined });
  let result = normalizeRecognitionNutrition(enriched);

  const remaining = Math.max(0, deadlineMs - Date.now());
  const { result: enrichedResult } = await runEnrichmentWithBudget(
    result,
    userId,
    remaining,
    result.dishName,
  );
  result = enrichedResult;

  return finalizeRecognitionResult(result, userId);
}

export async function recognizeFoodWithAI(
  imageBuffer: Buffer,
  filename: string,
  userId?: string | null,
  options?: { barcode?: string | null; visionHints?: VisionPromptHints },
): Promise<FoodRecognitionResult> {
  if (!process.env.GIGACHAT_CREDENTIALS) {
    throw new Error(
      "Не задан GIGACHAT_CREDENTIALS в .env. Получите ключ: https://developers.sber.ru/studio/workspaces",
    );
  }

  const barcodeHint = options?.barcode ? normalizeBarcode(options.barcode) : null;
  if (barcodeHint) {
    try {
      return await lookupFoodByBarcode(barcodeHint, userId);
    } catch {
      // OFF miss — fall through to vision with the same code as hint.
    }
  }

  const vision = await recognizeWithGigaChat(imageBuffer, filename, { hints: options?.visionHints });
  return enrichRecognitionAfterVision(vision, userId);
}

async function withFoodImage(
  result: FoodRecognitionResult,
  query: string,
): Promise<FoodRecognitionResult> {
  const imageUrl = await findFoodImage({
    query: result.dishName || query,
    brand: result.brand,
    productImageUrl: result.imageUrl,
  });

  return imageUrl ? { ...result, imageUrl } : result;
}

async function packToRecognitionResult(
  pack: PackNutrition,
  source: NonNullable<FoodRecognitionResult["source"]>,
  photoKind: PhotoKind,
  query: string,
  confidence = 0.75,
): Promise<FoodRecognitionResult> {
  return normalizeRecognitionNutrition(
    await withFoodImage(
      {
        dishName: pack.dishName,
        calories: pack.calories,
        protein: pack.protein,
        fat: pack.fat,
        carbs: pack.carbs,
        fiber: pack.fiber,
        sugar: pack.sugar,
        portionGrams: pack.portionGrams,
        barcode: pack.barcode,
        brand: pack.brand,
        imageUrl: pack.imageUrl,
        confidence,
        source,
        photoKind,
      },
      query,
    ),
  );
}

export async function lookupFoodByBarcode(
  barcodeInput: string,
  userId?: string | null,
): Promise<FoodRecognitionResult> {
  const barcode = normalizeBarcode(barcodeInput);
  if (!barcode) {
    throw new Error("Укажите корректный штрихкод (8, 12 или 13 цифр)");
  }

  const off = await lookupOpenFoodFactsByBarcodeWithRepair(barcode);
  if (!off) {
    throw new Error("Продукт не найден в базе Open Food Facts");
  }

  // Keep OFF gaps as undefined (not fake 0). Optional short fiber/sugar ask with hard timeout.
  let result = normalizeRecognitionNutrition(
    await withFoodImage(
      {
        dishName: off.dishName,
        calories: off.calories,
        protein: off.protein,
        fat: off.fat,
        carbs: off.carbs,
        fiber: off.fiber,
        sugar: off.sugar,
        portionGrams: off.portionGrams,
        barcode: off.barcode ?? barcode,
        brand: off.brand,
        imageUrl: off.imageUrl,
        confidence: 0.9,
        source: "openfoodfacts-barcode",
        photoKind: "barcode",
      },
      off.dishName,
    ),
  );

  if (needsFiberSugarBackfill(result)) {
    result = await withTimeoutFallback(
      enrichMissingFiberSugar(result, off.dishName || barcode, off, { skipFullLookup: true }),
      BARCODE_FIBER_SUGAR_MS,
      result,
    );
  }

  return applyStoredFoodCorrection(normalizeRecognitionNutrition(result), userId);
}

export async function lookupFoodByName(
  dishName: string,
  userId?: string | null,
): Promise<FoodRecognitionResult> {
  if (!dishName.trim()) {
    throw new Error("Укажите название блюда");
  }

  const remembered = await lookupStoredFoodCorrection(dishName, userId);
  if (remembered) {
    let result = normalizeRecognitionNutrition(
      await withFoodImage(remembered, dishName),
    );
    result = await enrichMissingFiberSugar(result, dishName);
    return result;
  }

  const off = await searchOpenFoodFactsBest(
    lookupQueriesForName(dishName, simplifyDishNameForLookup(dishName), 2),
  );
  const offMatch =
    off && offMatchesQuery(dishName, off.dishName, off.brand) ? off : null;
  let result: FoodRecognitionResult | null = null;

  if (offMatch) {
    result = await packToRecognitionResult(
      offMatch,
      "openfoodfacts-search",
      "package",
      dishName,
      0.8,
    );
  }

  if (!result) {
    const ruQueries = lookupQueriesForName(
      dishName,
      simplifyDishNameForLookup(dishName),
      3,
    );
    for (const query of ruQueries) {
      const ru = lookupRuNutritionTable(query);
      if (ru) {
        result = await packToRecognitionResult(ru, "ru-nutrition-table", "meal", dishName, 0.72);
        break;
      }
    }
  }

  if (!result) {
    if (!process.env.GIGACHAT_CREDENTIALS) {
      throw new Error(
        "Не задан GIGACHAT_CREDENTIALS в .env. Получите ключ: https://developers.sber.ru/studio/workspaces",
      );
    }

    const ai = await lookupFoodWithGigaChat(dishName);
    result = normalizeRecognitionNutrition(
      await withFoodImage(
        { ...ai, source: "gigachat-lookup", photoKind: "meal" },
        dishName,
      ),
    );
  }

  result = await enrichMissingFiberSugar(result, dishName, offMatch);

  return applyStoredFoodCorrection(normalizeRecognitionNutrition(result), userId);
}

/**
 * Single fiber/sugar enrichment path for photo, text, and barcode.
 * Order: OFF pack fields → short GigaChat fiber/sugar ask → full name lookup.
 * Never overwrites explicit zeros (meat etc.).
 * Leaves gaps as undefined when unknown (do not fake 0 — that hides missing data).
 */
async function enrichMissingFiberSugar(
  result: FoodRecognitionResult,
  dishName: string,
  off?: PackNutrition | null,
  options?: { skipFullLookup?: boolean },
): Promise<FoodRecognitionResult> {
  let next = result;

  if (
    needsFiberSugarBackfill(next) &&
    off &&
    (off.fiber !== undefined || off.sugar !== undefined)
  ) {
    next = mergeFiberSugarBackfill(next, {
      dishName: off.dishName || dishName,
      calories: off.calories,
      protein: off.protein,
      fat: off.fat,
      carbs: off.carbs,
      fiber: off.fiber,
      sugar: off.sugar,
      portionGrams: off.portionGrams,
      confidence: 0.8,
      source: "openfoodfacts-search",
      photoKind: "package",
    });
  }

  if (!needsFiberSugarBackfill(next)) {
    return next;
  }

  const tableHit = lookupFiberSugarTable(dishName, next.portionGrams);
  if (tableHit) {
    next = {
      ...next,
      fiber: next.fiber !== undefined ? next.fiber : tableHit.fiber,
      sugar: next.sugar !== undefined ? next.sugar : tableHit.sugar,
    };
  }

  if (!needsFiberSugarBackfill(next)) {
    return next;
  }

  if (process.env.GIGACHAT_CREDENTIALS) {
    try {
      // Prefer a short fiber/sugar ask — we already have calories/macros from OFF or text lookup.
      const partial = await lookupFiberSugarWithGigaChat(dishName, next.portionGrams);
      next = {
        ...next,
        fiber: next.fiber !== undefined ? next.fiber : partial.fiber,
        sugar: next.sugar !== undefined ? next.sugar : partial.sugar,
      };

      if (
        !options?.skipFullLookup &&
        needsFiberSugarBackfill(next) &&
        next.source !== "gigachat-lookup"
      ) {
        const ai = await lookupFoodWithGigaChat(dishName);
        next = mergeFiberSugarBackfill(
          next,
          normalizeRecognitionNutrition({
            ...ai,
            source: "gigachat-lookup",
            photoKind: "meal",
          }),
        );
      }
    } catch (error) {
      console.error(error);
    }
  }

  return next;
}
