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


function incompleteMultiDishItemCount(result: FoodRecognitionResult): number {
  const items = result.items ?? [];
  if (items.length < 2) return 0;
  return items.filter(
    (item) => (item.calories ?? 0) <= 0 || !(item.portionGrams && item.portionGrams > 0),
  ).length;
}

export function countIncompleteMultiDishItems(result: FoodRecognitionResult): number {
  return incompleteMultiDishItemCount(result);
}

/**
 * Force parent calories/macros/portion from item sums when the plate has ≥2 items
 * and any item was incomplete or parent totals still look stale vs the items.
 */
export function reconcileMultiDishFromItems(
  result: FoodRecognitionResult,
): FoodRecognitionResult {
  const items = result.items ?? [];
  if (items.length < 2) return result;

  const itemCalories = items.reduce((sum, item) => sum + Math.max(0, item.calories || 0), 0);
  if (itemCalories <= 0) return result;

  // Always rebuild parent from item sums once we have a usable multi-dish plate.
  // (Incomplete slots still contribute 0 — caller should merge/retry first.)
  return combineRecognitionItems(items, { ...result, calories: 0 });
}

/**
 * Item-wise merge for multi-dish incomplete retries: fill zero/missing fields from
 * the candidate while keeping good items from the current plate.
 */
export function mergeMultiDishRecognition(
  current: FoodRecognitionResult,
  candidate: FoodRecognitionResult,
): FoodRecognitionResult {
  const curItems = current.items ?? [];
  const newItems = candidate.items ?? [];
  if (curItems.length < 2 || newItems.length < 2) {
    return candidate;
  }

  const merged = curItems.map((item, index) => {
    const other = newItems[index];
    if (!other) return item;

    const caloriesBroken = (item.calories ?? 0) <= 0;
    const portionBroken = !(item.portionGrams && item.portionGrams > 0);

    return {
      ...item,
      dishName:
        !item.dishName?.trim() || /^еда|блюдо$/i.test(item.dishName.trim())
          ? other.dishName || item.dishName
          : item.dishName,
      calories: caloriesBroken && (other.calories ?? 0) > 0 ? other.calories : item.calories,
      protein: caloriesBroken ? other.protein ?? item.protein : item.protein,
      fat: caloriesBroken ? other.fat ?? item.fat : item.fat,
      carbs: caloriesBroken ? other.carbs ?? item.carbs : item.carbs,
      fiber: caloriesBroken ? other.fiber ?? item.fiber : item.fiber,
      sugar: caloriesBroken ? other.sugar ?? item.sugar : item.sugar,
      portionGrams:
        portionBroken && other.portionGrams && other.portionGrams > 0
          ? other.portionGrams
          : item.portionGrams,
      confidence: Math.max(item.confidence ?? 0, other.confidence ?? 0),
    };
  });

  // Append extra candidate items beyond current length.
  if (newItems.length > curItems.length) {
    merged.push(...newItems.slice(curItems.length));
  }

  return reconcileMultiDishFromItems({
    ...current,
    ...candidate,
    items: merged,
    dishName: current.dishName || candidate.dishName,
  });
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
