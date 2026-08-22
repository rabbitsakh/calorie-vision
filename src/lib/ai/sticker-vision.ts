import type { FoodRecognitionResult } from "../food-types";

function hasStickerNutrition(result: FoodRecognitionResult): boolean {
  if (result.calories > 0) {
    const macros = [result.protein, result.fat, result.carbs].filter((v) => v !== undefined);
    if (macros.length >= 2) return true;
  }
  return (result.per100g?.calories ?? 0) > 0;
}

/**
 * Ready-meal stickers often come back as label with empty macros.
 * Do NOT run for factory `package` — that path already has package/barcode specialists
 * and was cascading into extra GigaChat calls (timeouts + 429).
 */
export function shouldRunStickerPass(result: FoodRecognitionResult): boolean {
  if (hasStickerNutrition(result)) return false;

  // Printed cafe/deli sticker misread as a nutrition label.
  if (result.photoKind === "label") return true;

  return false;
}

export function isBetterStickerResult(
  current: FoodRecognitionResult,
  candidate: FoodRecognitionResult,
): boolean {
  const score = (r: FoodRecognitionResult) => {
    let s = 0;
    if (r.calories > 0) s += 2;
    if ([r.protein, r.fat, r.carbs].filter((v) => v !== undefined).length >= 2) s += 2;
    if ((r.per100g?.calories ?? 0) > 0) s += 2;
    if (r.portionGrams && r.portionGrams > 0) s += 1;
    if (r.dishName.trim() && !/не удалось/i.test(r.dishName)) s += 1;
    return s;
  };
  return score(candidate) > score(current);
}
