import type { FoodRecognitionResult, PhotoKind } from "@/lib/food-types";
import { isGigaChatApiError } from "@/lib/ai/gigachat-errors";
import { lookupFiberSugarWithGigaChat, lookupFiberSugarBatchWithGigaChat, lookupFoodByBarcodeWithGigaChat, lookupFoodWithGigaChat, recognizeWithGigaChat } from "@/lib/ai/gigachat";
import type { VisionPromptHints } from "@/lib/ai/prompt-variants";
import { logRecognitionPass } from "@/lib/ai/recognition-telemetry";
import { mapPool, withTimeoutFallback } from "@/lib/async-pool";
import { normalizeBarcode } from "@/lib/barcode";
import {
  formatBarcodeWebContext,
  gatherBarcodeWebEvidence,
  pickBarcodeWebProductName,
} from "@/lib/barcode-web-lookup";
import {
  applyStoredFoodCorrection,
  lookupStoredFoodCorrection,
} from "@/lib/food-corrections-store";
import { findFoodImage } from "@/lib/food-image";
import { lookupFiberSugarTable } from "@/lib/fiber-sugar-table";
import { enrichAlternatives } from "@/lib/recognition-alternatives";
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
  resolveDisplayPortionGrams,
  resolvePer100gForScaling,
  scaleRecognitionToPortion,
  shouldSkipSlowPostVisionEnrichment,
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
/** Label/package/barcode — vision calories are enough; keep SSE phase short. */
const PACKAGED_ENRICH_BUDGET_MS = 12_000;
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
  const portionGrams = resolveDisplayPortionGrams(vision) ?? vision.portionGrams ?? 100;
  const per100g = resolvePer100gForScaling(vision) ?? normalizePer100gEnergy(vision.per100g);

  if (per100g && per100g.calories > 0 && portionGrams > 0) {
    const scaled = scaleRecognitionToPortion(vision, portionGrams);
    return {
      ...vision,
      per100g,
      calories: scaled.calories,
      protein: scaled.protein ?? vision.protein,
      fat: scaled.fat ?? vision.fat,
      carbs: scaled.carbs ?? vision.carbs,
      fiber: scaled.fiber ?? vision.fiber,
      sugar: scaled.sugar ?? vision.sugar,
      portionGrams: scaled.portionGrams ?? portionGrams,
      photoKind: "label",
      source: "label",
      confidence: Math.max(vision.confidence, 0.8),
    };
  }

  const legacyPer100g = normalizePer100gEnergy(vision.per100g);
  const grams = vision.portionGrams && vision.portionGrams > 0 ? vision.portionGrams : 100;
  if (legacyPer100g && legacyPer100g.calories > 0) {
    const scaled = nutritionFromPer100g(legacyPer100g, grams);
    if (scaled) {
      return {
        ...vision,
        per100g: legacyPer100g,
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
    per100g: legacyPer100g,
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

/** Cap AI barcode estimates so the UI shows lower confidence than OFF hits. */
export function finalizeGigaChatBarcodeResult(
  ai: FoodRecognitionResult,
  barcode: string,
): FoodRecognitionResult {
  const confidence = Math.min(Math.max(ai.confidence || 0.55, 0.45), 0.7);
  return {
    ...ai,
    barcode,
    photoKind: "barcode",
    source: "gigachat-barcode",
    confidence,
  };
}

function mergeGigaChatBarcodeNutrition(
  vision: FoodRecognitionResult,
  ai: FoodRecognitionResult,
  barcode: string,
): FoodRecognitionResult {
  const finalized = finalizeGigaChatBarcodeResult(ai, barcode);
  const useAiNutrition = !hasUsableCalories(vision) || vision.calories <= 0;
  const photoKind =
    vision.photoKind === "meal" ? "barcode" : vision.photoKind ?? "barcode";

  return {
    ...vision,
    dishName: finalized.dishName || vision.dishName,
    brand: finalized.brand || vision.brand,
    barcode,
    photoKind,
    source: "gigachat-barcode",
    confidence: Math.min(Math.max(vision.confidence, finalized.confidence), 0.7),
    imageUrl: finalized.imageUrl ?? vision.imageUrl,
    ...(useAiNutrition
      ? {
          calories: finalized.calories,
          protein: finalized.protein,
          fat: finalized.fat,
          carbs: finalized.carbs,
          fiber: finalized.fiber ?? vision.fiber,
          sugar: finalized.sugar ?? vision.sugar,
          portionGrams: finalized.portionGrams || vision.portionGrams,
          per100g: finalized.per100g ?? vision.per100g,
        }
      : {
          fiber: vision.fiber !== undefined ? vision.fiber : finalized.fiber,
          sugar: vision.sugar !== undefined ? vision.sugar : finalized.sugar,
        }),
  };
}

/** After GigaChat names a barcode product, try OFF search by name/brand for stronger data. */
async function upgradeBarcodeGigaChatWithOff(
  ai: FoodRecognitionResult,
  barcode: string,
): Promise<FoodRecognitionResult | null> {
  const query = [ai.brand, ai.dishName].filter(Boolean).join(" ").trim();
  if (!query || isFailedName(query)) {
    return null;
  }
  const off = await searchOpenFoodFactsBest(
    [query, ai.dishName.trim()].filter(Boolean),
  );
  if (off && offMatchesQuery(query, off.dishName, off.brand)) {
    return mergeOffNutrition(
      { ...ai, barcode, photoKind: "barcode" },
      off,
      "openfoodfacts-search",
      barcode,
    );
  }
  return null;
}

/** Try OFF / RU table by a web- or AI-derived product name. */
async function lookupNutritionByProductName(
  name: string,
  brand?: string,
): Promise<FoodRecognitionResult | null> {
  const query = [brand, name].filter(Boolean).join(" ").trim();
  if (!query || isFailedName(query)) {
    return null;
  }

  const off = await searchOpenFoodFactsBest(
    [query, name.trim()].filter(Boolean),
  );
  if (off && offMatchesQuery(query, off.dishName, off.brand)) {
    return packToRecognitionResult(off, "openfoodfacts-search", "barcode", query, 0.78);
  }

  const ruQueries = lookupQueriesForName(name, simplifyDishNameForLookup(name), 3);
  for (const q of ruQueries) {
    const ru = lookupRuNutritionTable(q);
    if (ru) {
      return packToRecognitionResult(ru, "ru-nutrition-table", "barcode", name, 0.68);
    }
  }

  return null;
}

async function lookupBarcodeViaGigaChat(
  barcode: string,
  options?: { rethrowApiErrors?: boolean },
): Promise<FoodRecognitionResult | null> {
  if (!process.env.GIGACHAT_CREDENTIALS) {
    console.warn("GigaChat barcode fallback skipped: GIGACHAT_CREDENTIALS missing");
    return null;
  }

  try {
    const evidence = await gatherBarcodeWebEvidence(barcode);
    const webContext = formatBarcodeWebContext(evidence);
    const webName = pickBarcodeWebProductName(evidence);

    // Fast path: internet already named the product → OFF / RU before calling the LLM.
    if (webName) {
      const named = await lookupNutritionByProductName(webName, evidence.brand);
      if (named && hasUsableCalories(named)) {
        return {
          ...named,
          barcode,
          brand: named.brand || evidence.brand || named.brand,
          photoKind: "barcode",
          confidence: Math.min(named.confidence || 0.75, 0.85),
        };
      }
    }

    const ai = await lookupFoodByBarcodeWithGigaChat(barcode, webContext || undefined);
    const dishName = ai.dishName?.trim();

    if (dishName && !isFailedName(dishName) && !hasUsableCalories(ai)) {
      const named = await lookupNutritionByProductName(dishName, ai.brand || evidence.brand);
      if (named && hasUsableCalories(named)) {
        return {
          ...named,
          barcode,
          dishName: named.dishName || dishName,
          brand: named.brand || ai.brand || evidence.brand,
          photoKind: "barcode",
          confidence: Math.min(Math.max(ai.confidence, 0.55), 0.8),
        };
      }

      // Name-only AI fallback: ask GigaChat for macros by dish name.
      try {
        const byName = await lookupFoodWithGigaChat(dishName);
        if (hasUsableCalories(byName)) {
          return finalizeGigaChatBarcodeResult(
            {
              ...byName,
              dishName: byName.dishName || dishName,
              brand: byName.brand || ai.brand || evidence.brand,
            },
            barcode,
          );
        }
      } catch (error) {
        console.warn("GigaChat name enrichment after barcode failed", error);
      }
    }

    if (!hasUsableCalories(ai) || !dishName || isFailedName(dishName)) {
      console.warn("GigaChat barcode fallback returned unusable result", {
        barcode,
        dishName,
        calories: ai.calories,
        webTitles: evidence.titles.slice(0, 3),
        webSources: evidence.sources,
      });
      return null;
    }

    const upgraded = await upgradeBarcodeGigaChatWithOff(ai, barcode);
    return upgraded ?? finalizeGigaChatBarcodeResult(ai, barcode);
  } catch (error) {
    if (options?.rethrowApiErrors && isGigaChatApiError(error)) {
      throw error;
    }
    console.warn("GigaChat barcode fallback failed", error);
    return null;
  }
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

    // OFF miss: ask GigaChat keyed on the scanned digits, then optionally OFF-by-name.
    const gc = await lookupBarcodeViaGigaChat(barcode);
    if (gc) {
      if (gc.source === "openfoodfacts-search") {
        return gc;
      }
      return mergeGigaChatBarcodeNutrition(vision, gc, barcode);
    }
  }

  if (vision.photoKind === "label" || (vision.per100g && vision.per100g.calories > 0)) {
    if (
      hasMacros(vision) ||
      (vision.per100g && vision.per100g.calories > 0) ||
      (vision.photoKind === "label" && vision.calories > 0)
    ) {
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
      if (hasCompleteVisionNutrition(next) || shouldSkipSlowPostVisionEnrichment(next)) {
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

  return {
    result: gate.cancelled ? { ...enriched, enrichmentTimedOut: true } : enriched,
    timedOut: gate.cancelled,
  };
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

async function finalizeRecognitionResult(
  result: FoodRecognitionResult,
  userId?: string | null,
  deadlineMs?: number,
): Promise<FoodRecognitionResult> {
  const remainingMs = deadlineMs ? Math.max(0, deadlineMs - Date.now()) : 2500;
  const withAlternatives = await withTimeoutFallback(
    enrichAlternatives(result, { deadlineMs }),
    Math.min(Math.max(remainingMs, 500), 3000),
    result,
  );
  return applyStoredFoodCorrection(normalizeRecognitionNutrition(withAlternatives), userId);
}

export async function enrichRecognitionAfterVision(
  vision: FoodRecognitionResult,
  userId?: string | null,
): Promise<FoodRecognitionResult> {
  const packaged =
    vision.photoKind === "label" ||
    vision.photoKind === "package" ||
    vision.photoKind === "barcode";
  const deadlineMs = Date.now() + (packaged ? PACKAGED_ENRICH_BUDGET_MS : POST_VISION_BUDGET_MS);
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
      deadlineMs,
    );
  }

  const enriched = await withTimeoutFallback(
    enrichPackagedProduct({ ...vision, source: "gigachat", items: undefined }),
    Math.max(0, deadlineMs - Date.now()),
    { ...vision, source: "gigachat", items: undefined },
  );
  let result = normalizeRecognitionNutrition(enriched);

  const remaining = Math.max(0, deadlineMs - Date.now());
  const { result: enrichedResult } = await runEnrichmentWithBudget(
    result,
    userId,
    remaining,
    result.dishName,
  );
  result = enrichedResult;

  return finalizeRecognitionResult(result, userId, deadlineMs);
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
  let result: FoodRecognitionResult;

  if (off) {
    // Keep OFF gaps as undefined (not fake 0). Optional short fiber/sugar ask with hard timeout.
    result = normalizeRecognitionNutrition(
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

  const gc = await lookupBarcodeViaGigaChat(barcode, { rethrowApiErrors: true });
  if (!gc) {
    throw new Error(
      "Продукт не найден по штрихкоду: нет в Open Food Facts, и не удалось определить через интернет / GigaChat",
    );
  }

  result = normalizeRecognitionNutrition(await withFoodImage(gc, gc.dishName || barcode));

  if (needsFiberSugarBackfill(result) && result.source === "gigachat-barcode") {
    // GigaChat already returned macros; only a short fiber/sugar fill if still missing.
    result = await withTimeoutFallback(
      enrichMissingFiberSugar(result, gc.dishName || barcode, null, { skipFullLookup: true }),
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
        next.source !== "gigachat-lookup" &&
        next.source !== "gigachat-barcode"
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
