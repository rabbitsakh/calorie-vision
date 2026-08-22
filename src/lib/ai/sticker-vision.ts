import type { FoodRecognitionResult } from "../food-types";

function hasStickerNutrition(result: FoodRecognitionResult): boolean {
  if (result.calories > 0) {
    const macros = [result.protein, result.fat, result.carbs].filter((v) => v !== undefined);
    if (macros.length >= 2) return true;
  }
  return (result.per100g?.calories ?? 0) > 0;
}

/**
 * Ready-meal stickers often come back as meal/package with empty macros.
 * Trigger when kind hints at a printed sticker and nutrition is missing.
 */
export function shouldRunStickerPass(result: FoodRecognitionResult): boolean {
  if (hasStickerNutrition(result)) return false;

  // Explicit label with empty nutrition — sticker specialist can recover cafe print.
  if (result.photoKind === "label") return true;

  // Package without barcode/brand often is a deli bowl sticker misclassified as package.
  if (
    result.photoKind === "package" &&
    !result.barcode?.trim() &&
    result.confidence >= 0.35
  ) {
    return true;
  }

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
