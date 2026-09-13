import type { FoodRecognitionResult } from "@/lib/food-types";
import { looksLikePreparedFoodName } from "@/lib/ai/sticker-vision";

/** Typical cafe / ready-meal bowl weights when sticker grams are missing. */
export const READY_MEAL_PORTION_CHIPS = [300, 350, 400] as const;

/**
 * Extra portion chips for packaged / ready-meal sticker drafts.
 * Prefers vision sticker grams when present; otherwise 300/350/400 g.
 */
export function readyMealPortionChipGrams(
  item: Pick<FoodRecognitionResult, "photoKind" | "dishName" | "brand" | "portionGrams">,
): number[] {
  const packaged =
    item.photoKind === "package" ||
    item.photoKind === "barcode" ||
    item.photoKind === "label";
  if (!packaged) return [];
  if (!looksLikePreparedFoodName(item.dishName, item.brand)) return [];

  const stickerGrams =
    item.portionGrams && item.portionGrams > 0 ? item.portionGrams : undefined;
  const chips = [...READY_MEAL_PORTION_CHIPS];

  if (!stickerGrams) return chips;
  if (chips.includes(stickerGrams as (typeof READY_MEAL_PORTION_CHIPS)[number])) {
    return [stickerGrams, ...chips.filter((g) => g !== stickerGrams)];
  }
  return [stickerGrams, ...chips];
}
