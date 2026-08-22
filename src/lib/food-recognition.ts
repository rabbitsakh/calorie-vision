import type { FoodRecognitionResult, PhotoKind } from "@/lib/food-types";
import { lookupFiberSugarWithGigaChat, lookupFoodWithGigaChat, recognizeWithGigaChat } from "@/lib/ai/gigachat";
import { normalizeBarcode } from "@/lib/barcode";
import {
  applyStoredFoodCorrection,
  lookupStoredFoodCorrection,
} from "@/lib/food-corrections-store";
import { findFoodImage } from "@/lib/food-image";
import {
  combineRecognitionItems,
  isMultiItemRecognition,
} from "@/lib/recognition-items";
import {
  hasUsableCalories,
  hasSufficientVisionNutrition,
  mergeFiberSugarBackfill,
  mergeNutritionBackfill,
  needsFiberSugarBackfill,
  needsNutritionLookup,
  normalizeRecognitionNutrition,
  simplifyDishNameForLookup,
} from "@/lib/recognition-nutrition";
import {
  lookupOpenFoodFactsByBarcode,
  nutritionFromPer100g,
  offMatchesQuery,
  searchOpenFoodFacts,
  type PackNutrition,
} from "@/lib/open-food-facts";

export type { FoodRecognitionResult, PhotoKind } from "@/lib/food-types";
export { RECOGNITION_SOURCE_LABELS } from "@/lib/food-types";

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
  const grams = vision.portionGrams && vision.portionGrams > 0 ? vision.portionGrams : 100;
  if (vision.per100g && vision.per100g.calories > 0) {
    const scaled = nutritionFromPer100g(vision.per100g, grams);
    if (scaled) {
      return {
        ...vision,
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
    return off.portionGrams;
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

  return off.portionGrams;
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
    const off = await lookupOpenFoodFactsByBarcode(barcode);
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
    const off = await searchOpenFoodFacts(query);
    if (off && offMatchesQuery(query, off.dishName)) {
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
): Promise<FoodRecognitionResult> {
  if (!needsNutritionLookup(result)) {
    return result;
  }

  const names = [result.dishName.trim()].filter(Boolean);
  const simplified = simplifyDishNameForLookup(result.dishName);
  if (simplified && !names.some((n) => n.toLowerCase() === simplified.toLowerCase())) {
    names.push(simplified);
  }

  let best = result;

  for (const name of names) {
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

async function enrichMealItem(
  vision: FoodRecognitionResult,
  userId?: string | null,
): Promise<FoodRecognitionResult> {
  let result = normalizeRecognitionNutrition({
    ...vision,
    photoKind: vision.photoKind ?? "meal",
    source: vision.source ?? "gigachat",
    items: undefined,
  });

  // If the item has per100g data (e.g. a packaged snack on the plate), scale it
  if (result.per100g && result.per100g.calories > 0 && result.calories <= 0) {
    result = normalizeRecognitionNutrition(nutritionFromLabel(result));
  }

  // Skip GC/OFF backfill when vision already filled calories + macros (saves tokens).
  if (!hasSufficientVisionNutrition(result)) {
    result = await backfillMissingNutrition(result, userId);
  }
  // Same fiber/sugar path as text + barcode (calories may already be complete).
  result = await enrichMissingFiberSugar(result, result.dishName);

  return applyStoredFoodCorrection(normalizeRecognitionNutrition(result), userId);
}

export async function recognizeFoodWithAI(
  imageBuffer: Buffer,
  filename: string,
  userId?: string | null,
): Promise<FoodRecognitionResult> {
  if (!process.env.GIGACHAT_CREDENTIALS) {
    throw new Error(
      "Не задан GIGACHAT_CREDENTIALS в .env. Получите ключ: https://developers.sber.ru/studio/workspaces",
    );
  }

  const vision = await recognizeWithGigaChat(imageBuffer, filename);
  const plated =
    (vision.photoKind === "meal" || vision.photoKind === undefined) && isMultiItemRecognition(vision);

  if (plated && vision.items) {
    const processed = await Promise.all(vision.items.map((item) => enrichMealItem(item, userId)));
    return combineRecognitionItems(processed, { ...vision, source: "gigachat" });
  }

  const enriched = await enrichPackagedProduct({ ...vision, source: "gigachat", items: undefined });
  let result = normalizeRecognitionNutrition(enriched);
  if (!hasSufficientVisionNutrition(result)) {
    result = await backfillMissingNutrition(result, userId);
  }
  result = await enrichMissingFiberSugar(result, result.dishName);

  return applyStoredFoodCorrection(normalizeRecognitionNutrition(result), userId);
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

export async function lookupFoodByBarcode(barcodeInput: string): Promise<FoodRecognitionResult> {
  const barcode = normalizeBarcode(barcodeInput);
  if (!barcode) {
    throw new Error("Укажите корректный штрихкод (8, 12 или 13 цифр)");
  }

  const off = await lookupOpenFoodFactsByBarcode(barcode);
  if (!off) {
    throw new Error("Продукт не найден в базе Open Food Facts");
  }

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

  // Many OFF products omit fiber_100g / sugars_100g — same empty fields as text lookup.
  result = await enrichMissingFiberSugar(result, off.dishName || barcode, off);
  return normalizeRecognitionNutrition(result);
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

  const off = await searchOpenFoodFacts(dishName);
  const offMatch =
    off && offMatchesQuery(dishName, off.dishName) ? off : null;
  let result: FoodRecognitionResult | null = null;

  if (offMatch) {
    result = normalizeRecognitionNutrition(
      await withFoodImage(
        {
          dishName: offMatch.dishName || dishName.trim(),
          calories: offMatch.calories,
          protein: offMatch.protein,
          fat: offMatch.fat,
          carbs: offMatch.carbs,
          fiber: offMatch.fiber,
          sugar: offMatch.sugar,
          portionGrams: offMatch.portionGrams,
          barcode: offMatch.barcode,
          brand: offMatch.brand,
          imageUrl: offMatch.imageUrl,
          confidence: 0.8,
          source: "openfoodfacts-search",
          photoKind: "package",
        },
        dishName,
      ),
    );
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
 */
async function enrichMissingFiberSugar(
  result: FoodRecognitionResult,
  dishName: string,
  off?: PackNutrition | null,
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

  if (process.env.GIGACHAT_CREDENTIALS) {
    try {
      // Prefer a short fiber/sugar ask — we already have calories/macros from OFF or text lookup.
      const partial = await lookupFiberSugarWithGigaChat(dishName, next.portionGrams);
      next = {
        ...next,
        fiber: next.fiber !== undefined ? next.fiber : partial.fiber,
        sugar: next.sugar !== undefined ? next.sugar : partial.sugar,
      };

      if (needsFiberSugarBackfill(next) && next.source !== "gigachat-lookup") {
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

  // Confirm UI shows blank inputs for undefined — prefer explicit 0 after all attempts.
  if (needsFiberSugarBackfill(next)) {
    next = {
      ...next,
      fiber: next.fiber !== undefined ? next.fiber : 0,
      sugar: next.sugar !== undefined ? next.sugar : 0,
    };
  }

  return next;
}
