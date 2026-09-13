import type { FoodRecognitionResult } from "@/lib/food-types";
import { looksLikePreparedFoodName } from "@/lib/ai/sticker-vision";
import { looksLikeDrinkName, looksLikeSnackBarName } from "@/lib/portion-unit";
import { resolveDisplayPortionGrams } from "@/lib/recognition-nutrition";

/** Typical cafe / ready-meal bowl weights when sticker grams are missing. */
export const READY_MEAL_PORTION_CHIPS = [300, 350, 400] as const;

/** Drink confirm chips — include small glasses and common can sizes. */
export const DRINK_PORTION_CHIPS = [150, 200, 250, 330, 350, 500, 1000, 1500] as const;

/** Default solid-food portion chips on confirm. */
export const MEAL_PORTION_CHIPS = [100, 150, 200, 250] as const;

/** Minimal dish shape for confirm portion chips. */
export type PortionChipDish = {
  dishName: string;
  original: FoodRecognitionResult;
};

function looksLikeDrink(dish: PortionChipDish): boolean {
  return looksLikeDrinkName(dish.dishName, dish.original.dishName, dish.original.brand);
}

/**
 * Build portion chip row for confirm UI (photo/½/pack/history + defaults, capped).
 */
export function portionChipOptions(
  dish: PortionChipDish,
  historyPortions: number[] = [],
): Array<{ label: string; grams: number }> {
  const drink = looksLikeDrink(dish);
  const unit = drink ? "мл" : "г";
  const base: Array<{ label: string; grams: number }> = (
    drink ? DRINK_PORTION_CHIPS : MEAL_PORTION_CHIPS
  ).map((grams) => ({
    label: `${grams} ${unit}`,
    grams,
  }));

  const recognizedGrams =
    dish.original.portionGrams && dish.original.portionGrams > 0
      ? dish.original.portionGrams
      : undefined;
  const displayGrams = resolveDisplayPortionGrams(dish.original);
  const packaged =
    dish.original.photoKind === "package" ||
    dish.original.photoKind === "barcode" ||
    dish.original.photoKind === "label";

  // Vision often leaves 100 ml/g while display already resolved to bottle volume (e.g. 1500).
  const skipPhotoAsPer100 = Boolean(
    recognizedGrams &&
      displayGrams &&
      displayGrams > recognizedGrams &&
      recognizedGrams <= 100,
  );
  const photoGrams = skipPhotoAsPer100 ? undefined : recognizedGrams;
  const packGrams =
    packaged && displayGrams && displayGrams > 0 && displayGrams !== photoGrams
      ? displayGrams
      : undefined;

  const prependUnique = (chip: { label: string; grams: number }) => {
    if (!chip.grams || chip.grams <= 0) return;
    const existing = base.findIndex((item) => item.grams === chip.grams);
    if (existing >= 0) {
      base.splice(existing, 1);
    }
    base.unshift(chip);
  };

  const prependPhotoFamily = (grams: number) => {
    prependUnique({
      label: `Как на фото (${grams} ${unit})`,
      grams,
    });
    const half = Math.round(grams / 2);
    if (half >= 10) {
      prependUnique({
        label: `½ (${half} ${unit})`,
        grams: half,
      });
      // keep photo chip first: re-prepend after half
      prependUnique({
        label: `Как на фото (${grams} ${unit})`,
        grams,
      });
    }
  };

  if (photoGrams) {
    prependPhotoFamily(photoGrams);
  }

  if (packGrams) {
    const bar = looksLikeSnackBarName(dish.dishName, dish.original.dishName, dish.original.brand);
    prependUnique({
      label: bar
        ? `1 шт (${packGrams} г)`
        : drink
          ? `Вся упаковка (${packGrams} мл)`
          : `Вся упаковка (${packGrams} г)`,
      grams: packGrams,
    });
    if (!photoGrams) {
      const half = Math.round(packGrams / 2);
      if (half >= 10) {
        prependUnique({
          label: `½ (${half} ${unit})`,
          grams: half,
        });
        prependUnique({
          label: bar
            ? `1 шт (${packGrams} г)`
            : drink
              ? `Вся упаковка (${packGrams} мл)`
              : `Вся упаковка (${packGrams} г)`,
          grams: packGrams,
        });
      }
    }
  }

  for (const grams of historyPortions) {
    if (!grams || grams <= 0 || base.some((chip) => chip.grams === grams)) continue;
    base.push({
      label: `${grams} ${unit}`,
      grams,
    });
  }

  // Cafe / ready-meal stickers: offer ~300–400 g bowls when vision grams are weak.
  if (!drink) {
    for (const grams of readyMealPortionChipGrams(dish.original)) {
      if (!grams || base.some((chip) => chip.grams === grams)) continue;
      base.push({
        label: `${grams} ${unit}`,
        grams,
      });
    }
  }

  // Cap chip row — photo/½/history first, then defaults.
  return base.slice(0, 8);
}

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
