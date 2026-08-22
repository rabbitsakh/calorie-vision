import type { FoodRecognitionResult } from "./food-types";

const MAX_PLATE_ITEMS = 8;
const MAX_DISH_NAME_ITEMS = 3;

function sumDefined(values: Array<number | undefined>): number | undefined {
  const present = values.filter((value): value is number => value !== undefined && Number.isFinite(value));
  if (present.length === 0) {
    return undefined;
  }
  return Math.round(present.reduce((sum, value) => sum + value, 0) * 10) / 10;
}

export function isMultiItemRecognition(result: FoodRecognitionResult): boolean {
  return (result.items?.length ?? 0) >= 2;
}

export function flattenRecognitionItems(result: FoodRecognitionResult): FoodRecognitionResult[] {
  if (!isMultiItemRecognition(result) || !result.items) {
    const { items: _items, ...rest } = result;
    return [rest];
  }

  return result.items.slice(0, MAX_PLATE_ITEMS).map((item) => ({
    ...item,
    photoKind: item.photoKind ?? result.photoKind ?? "meal",
    source: item.source ?? result.source,
    items: undefined,
  }));
}

export function combineRecognitionItems(
  items: FoodRecognitionResult[],
  base: FoodRecognitionResult,
): FoodRecognitionResult {
  const cleaned = items.slice(0, MAX_PLATE_ITEMS).map((item) => {
    const { items: _items, ...rest } = item;
    return {
      ...rest,
      photoKind: rest.photoKind ?? base.photoKind ?? "meal",
      source: rest.source ?? "gigachat",
    };
  });

  if (cleaned.length === 0) {
    const { items: _items, ...rest } = base;
    return rest;
  }

  if (cleaned.length === 1) {
    return cleaned[0];
  }

  const nameItems = cleaned.slice(0, MAX_DISH_NAME_ITEMS);
  const remaining = cleaned.length - nameItems.length;
  const dishName =
    remaining > 0
      ? `${nameItems.map((item) => item.dishName).join(", ")} и ещё ${remaining}`
      : nameItems.map((item) => item.dishName).join(", ");

  const itemCalories = cleaned.reduce((sum, item) => sum + Math.max(0, item.calories || 0), 0);
  const baseCalories = Math.max(0, base.calories || 0);
  const useItemTotals =
    itemCalories > 0 &&
    (baseCalories <= 0 || Math.abs(itemCalories - baseCalories) / Math.max(itemCalories, baseCalories) > 0.15);

  return {
    ...base,
    dishName,
    calories: useItemTotals ? itemCalories : Math.max(baseCalories, itemCalories),
    protein: sumDefined(cleaned.map((item) => item.protein)),
    fat: sumDefined(cleaned.map((item) => item.fat)),
    carbs: sumDefined(cleaned.map((item) => item.carbs)),
    fiber: sumDefined(cleaned.map((item) => item.fiber)),
    sugar: sumDefined(cleaned.map((item) => item.sugar)),
    portionGrams: Math.round(sumDefined(cleaned.map((item) => item.portionGrams)) ?? 0) || undefined,
    confidence: Math.min(...cleaned.map((item) => item.confidence)),
    photoKind: "meal",
    source: "gigachat-plate",
    alternatives: undefined,
    barcode: undefined,
    brand: undefined,
    items: cleaned,
  };
}
