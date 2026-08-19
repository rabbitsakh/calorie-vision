import type { FoodRecognitionResult, PhotoKind } from "@/lib/food-types";
import { lookupFoodWithGigaChat, recognizeWithGigaChat } from "@/lib/ai/gigachat";
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
  needsNutritionLookup,
  normalizeRecognitionNutrition,
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

async function enrichMealItem(vision: FoodRecognitionResult): Promise<FoodRecognitionResult> {
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

  // Fallback lookup whenever nutrition is missing — confidence reflects dish
  // identification, not whether calories/macros were actually returned.
  if (needsNutritionLookup(result)) {
    try {
      const looked = await lookupFoodByName(result.dishName);
      if (!needsNutritionLookup(looked)) {
        result = normalizeRecognitionNutrition({
          ...looked,
          dishName: result.dishName,
          photoKind: "meal",
          confidence: Math.max(looked.confidence, result.confidence * 0.85),
        });
      }
    } catch (error) {
      console.error("Nutrition lookup fallback failed", error);
    }
  }

  return applyStoredFoodCorrection(normalizeRecognitionNutrition(result));
}

export async function recognizeFoodWithAI(
  imageBuffer: Buffer,
  filename: string,
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
    const processed = await Promise.all(vision.items.map((item) => enrichMealItem(item)));
    return combineRecognitionItems(processed, { ...vision, source: "gigachat" });
  }

  const enriched = await enrichPackagedProduct({ ...vision, source: "gigachat", items: undefined });
  let result = normalizeRecognitionNutrition(enriched);

  if (needsNutritionLookup(result)) {
    try {
      const looked = await lookupFoodByName(result.dishName);
      if (!needsNutritionLookup(looked)) {
        result = normalizeRecognitionNutrition({
          ...looked,
          confidence: Math.max(looked.confidence, result.confidence * 0.85),
        });
      }
    } catch (error) {
      console.error("Nutrition lookup fallback failed", error);
    }
  }

  return applyStoredFoodCorrection(normalizeRecognitionNutrition(result));
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

  return normalizeRecognitionNutrition(
    await withFoodImage(
      {
        dishName: off.dishName,
        calories: off.calories,
        protein: off.protein,
        fat: off.fat,
        carbs: off.carbs,
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
}

export async function lookupFoodByName(dishName: string): Promise<FoodRecognitionResult> {
  if (!dishName.trim()) {
    throw new Error("Укажите название блюда");
  }

  const remembered = await lookupStoredFoodCorrection(dishName);
  if (remembered) {
    return normalizeRecognitionNutrition(
      await withFoodImage(remembered, dishName),
    );
  }

  const off = await searchOpenFoodFacts(dishName);
  if (off && offMatchesQuery(dishName, off.dishName)) {
    return normalizeRecognitionNutrition(
      await withFoodImage(
        {
          dishName: off.dishName || dishName.trim(),
          calories: off.calories,
          protein: off.protein,
          fat: off.fat,
          carbs: off.carbs,
          portionGrams: off.portionGrams,
          barcode: off.barcode,
          brand: off.brand,
          imageUrl: off.imageUrl,
          confidence: 0.8,
          source: "openfoodfacts-search",
          photoKind: "package",
        },
        dishName,
      ),
    );
  }

  if (!process.env.GIGACHAT_CREDENTIALS) {
    throw new Error(
      "Не задан GIGACHAT_CREDENTIALS в .env. Получите ключ: https://developers.sber.ru/studio/workspaces",
    );
  }

  const result = await lookupFoodWithGigaChat(dishName);
  return applyStoredFoodCorrection(
    normalizeRecognitionNutrition(
      await withFoodImage({ ...result, source: "gigachat-lookup", photoKind: "meal" }, dishName),
    ),
  );
}
