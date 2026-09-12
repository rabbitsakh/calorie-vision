import type { FoodRecognitionResult } from "../food-types";
import { normalizeBarcode } from "../barcode";
import { looksLikeMultiDishName } from "./plate-vision";

/** Cafe / deli / takeaway prepared-food name cues on stickers and lids. */
const PREPARED_FOOD_NAME_RE =
  /(салат|суп|борщ|щи\b|каша|плов|паста|рис\b|гречк|овсян|котлет|пельмен|блин|омлет|яичниц|лапш|wok|боул|bowl|ланч|готовое|кулинари|цезарь|оливье|мимоза|пюре|рагу|гуляш|стейк|филе|куриц|индейк|говяд|овощ|тушен|запеч|жаркое|шницел|наггетс|крылыш|шаурм|бургер|сэндвич|sandwich)/iu;

const CAFE_OR_DELI_CUE_RE =
  /(кафе|coffee|like|кулинари|столов|deli|готовые\s*блюд|милти|шеф|шеф\s*перекр)/iu;

function hasUsableBarcode(result: FoodRecognitionResult): boolean {
  return Boolean(normalizeBarcode(result.barcode ?? null));
}

function hasStickerNutrition(result: FoodRecognitionResult): boolean {
  if (result.calories > 0) {
    const macros = [result.protein, result.fat, result.carbs].filter((v) => v !== undefined);
    if (macros.length >= 2) return true;
  }
  return (result.per100g?.calories ?? 0) > 0;
}

/** Empty calories / per100 — weak sticker OCR, not a plated meal missing macros. */
function hasWeakOrEmptyMacros(result: FoodRecognitionResult): boolean {
  if (hasStickerNutrition(result)) return false;
  return result.calories <= 0 && (result.per100g?.calories ?? 0) <= 0;
}

/** Factory packs with brand + net weight + barcode are not cafe stickers. */
function looksLikeFactoryPack(result: FoodRecognitionResult): boolean {
  const hasBrand = Boolean(result.brand?.trim());
  const hasNet = (result.portionGrams ?? 0) > 0;
  return hasBrand && hasNet && hasUsableBarcode(result);
}

/** Prepared-food / cafe dish name cues (salads, bowls, lids, deli boxes). */
export function looksLikePreparedFoodName(
  dishName: string,
  brand?: string | null,
): boolean {
  const name = dishName ?? "";
  const brandText = brand ?? "";
  return (
    PREPARED_FOOD_NAME_RE.test(name) ||
    CAFE_OR_DELI_CUE_RE.test(name) ||
    CAFE_OR_DELI_CUE_RE.test(brandText)
  );
}

function hasPreparedFoodCue(result: FoodRecognitionResult): boolean {
  return looksLikePreparedFoodName(result.dishName, result.brand);
}

/**
 * Ready-meal / cafe sticker heuristic: prepared-food cues, no usable barcode,
 * empty or weak macros. Excludes factory packs with brand + net + barcode.
 */
export function looksLikeReadyMealSticker(result: FoodRecognitionResult): boolean {
  if (looksLikeFactoryPack(result)) return false;
  if (hasUsableBarcode(result)) return false;
  if (result.photoKind === "meal" || result.photoKind === "barcode") return false;
  if (result.photoKind !== "label" && result.photoKind !== "package") return false;
  // Mixed plates misclassified as package belong to the plate specialist.
  if (looksLikeMultiDishName(result.dishName)) return false;
  if (!hasPreparedFoodCue(result)) return false;
  return hasWeakOrEmptyMacros(result);
}

/**
 * Ready-meal stickers often come back as label/package with empty macros.
 * Prefer sticker OCR over barcode/label table when the ready-meal heuristic matches.
 * Do NOT run for factory packs with brand+net+barcode.
 */
export function shouldRunStickerPass(result: FoodRecognitionResult): boolean {
  if (hasStickerNutrition(result)) return false;

  if (looksLikeReadyMealSticker(result)) return true;

  // Printed cafe/deli sticker misread as a nutrition label (even without dish cues).
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
