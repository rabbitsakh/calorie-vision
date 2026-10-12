/**
 * Soft-saved generic lookups that still need a brand upgrade in the diary.
 */

export type BrandRepairMealLike = {
  lookupMode?: string | null;
  brand?: string | null;
};

export function mealNeedsBrandRepair(meal: BrandRepairMealLike): boolean {
  if (meal.brand?.trim()) return false;
  return meal.lookupMode === "generic";
}

export type BrandLookupHit = {
  dishName?: string;
  brand?: string | null;
  lookupMode?: string | null;
  calories?: number;
  protein?: number | null;
  fat?: number | null;
  carbs?: number | null;
  fiber?: number | null;
  sugar?: number | null;
  portionGrams?: number | null;
};

export type BrandRepairPatch = {
  dishName: string;
  brand: string | null;
  lookupMode: string | null;
  calories: number;
  protein?: number | null;
  fat?: number | null;
  carbs?: number | null;
  fiber?: number | null;
  sugar?: number | null;
  portionGrams?: number | null;
};

/**
 * Prefer branded hit; keep existing macros unless lookup also fills them.
 */
export function buildBrandRepairPatch(
  meal: {
    dishName: string;
    calories: number;
    protein?: number | null;
    fat?: number | null;
    carbs?: number | null;
    fiber?: number | null;
    sugar?: number | null;
    portionGrams?: number | null;
    brand?: string | null;
    lookupMode?: string | null;
  },
  looked: BrandLookupHit,
): BrandRepairPatch | null {
  const brand = looked.brand?.trim() || null;
  const mode = looked.lookupMode?.trim() || null;
  if (!brand && mode !== "branded") return null;

  return {
    dishName: (looked.dishName ?? meal.dishName).trim() || meal.dishName,
    brand: brand ?? meal.brand?.trim() ?? null,
    lookupMode: mode ?? "branded",
    calories: meal.calories,
    protein: meal.protein ?? null,
    fat: meal.fat ?? null,
    carbs: meal.carbs ?? null,
    fiber: meal.fiber ?? null,
    sugar: meal.sugar ?? null,
    portionGrams: meal.portionGrams ?? null,
  };
}
