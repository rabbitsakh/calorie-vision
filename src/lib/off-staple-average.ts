/**
 * Build a typical (average) nutrition row from several OFF hits for a generic staple.
 * Used when the RU table misses and the user did not name a brand.
 */

import {
  offMatchesQuery,
  searchOpenFoodFactsCandidates,
  type PackNutrition,
} from "@/lib/open-food-facts";
import { normalizeFoodQueryKey } from "@/lib/food-query-parse";

function median(values: number[]): number | undefined {
  const sorted = values.filter((n) => Number.isFinite(n)).sort((a, b) => a - b);
  if (sorted.length === 0) return undefined;
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 1) {
    return sorted[mid];
  }
  return (sorted[mid - 1]! + sorted[mid]!) / 2;
}

function per100Calories(pack: PackNutrition): number | undefined {
  if (pack.per100g?.calories && pack.per100g.calories > 0) {
    return pack.per100g.calories;
  }
  if (pack.portionGrams > 0 && pack.calories > 0) {
    return (pack.calories / pack.portionGrams) * 100;
  }
  return undefined;
}

function per100Macro(pack: PackNutrition, key: "protein" | "fat" | "carbs" | "fiber" | "sugar"): number | undefined {
  const fromPer = pack.per100g?.[key];
  if (fromPer !== undefined && Number.isFinite(fromPer)) {
    return fromPer;
  }
  const total = pack[key];
  if (total !== undefined && pack.portionGrams > 0) {
    return (total / pack.portionGrams) * 100;
  }
  return undefined;
}

/** Weak / private-label brands still OK for a generic average; strong named brands are skipped. */
function looksLikeStrongBrand(brand: string | undefined): boolean {
  const b = normalizeFoodQueryKey(brand ?? "");
  if (!b || b.length < 2) return false;
  // Single generic words that OFF sometimes puts in brand
  if (/^(local|store|private|generic|без\s*бренда)$/i.test(b)) return false;
  return b.length >= 3;
}

function scaleFromPer100(
  per100: {
    calories: number;
    protein?: number;
    fat?: number;
    carbs?: number;
    fiber?: number;
    sugar?: number;
  },
  portionGrams: number,
  dishName: string,
): PackNutrition {
  const scale = portionGrams / 100;
  return {
    dishName,
    calories: Math.round(per100.calories * scale),
    protein: per100.protein !== undefined ? Math.round(per100.protein * scale * 10) / 10 : undefined,
    fat: per100.fat !== undefined ? Math.round(per100.fat * scale * 10) / 10 : undefined,
    carbs: per100.carbs !== undefined ? Math.round(per100.carbs * scale * 10) / 10 : undefined,
    fiber: per100.fiber !== undefined ? Math.round(per100.fiber * scale * 10) / 10 : undefined,
    sugar: per100.sugar !== undefined ? Math.round(per100.sugar * scale * 10) / 10 : undefined,
    portionGrams,
    explicitPackGrams: true,
    per100g: {
      calories: Math.round(per100.calories),
      protein: per100.protein !== undefined ? Math.round(per100.protein * 10) / 10 : undefined,
      fat: per100.fat !== undefined ? Math.round(per100.fat * 10) / 10 : undefined,
      carbs: per100.carbs !== undefined ? Math.round(per100.carbs * 10) / 10 : undefined,
      fiber: per100.fiber !== undefined ? Math.round(per100.fiber * 10) / 10 : undefined,
      sugar: per100.sugar !== undefined ? Math.round(per100.sugar * 10) / 10 : undefined,
    },
  };
}

/** Pure helper — average cleaned OFF hits (exported for unit tests). */
export function averagePackNutritionHits(
  query: string,
  hits: PackNutrition[],
  options?: { portionGrams?: number; minHits?: number },
): PackNutrition | null {
  const trimmed = query.trim();
  const minHits = options?.minHits ?? 2;
  const portionGrams = options?.portionGrams && options.portionGrams > 0 ? options.portionGrams : 100;

  const clean = hits.filter((hit) => {
    if (!offMatchesQuery(trimmed, hit.dishName, hit.brand)) return false;
    if (looksLikeStrongBrand(hit.brand)) {
      const q = normalizeFoodQueryKey(trimmed);
      const b = normalizeFoodQueryKey(hit.brand ?? "");
      if (!q.includes(b)) return false;
    }
    return per100Calories(hit) !== undefined;
  });

  if (clean.length < minHits) {
    return null;
  }

  const kcal = median(clean.map((h) => per100Calories(h)!));
  if (kcal === undefined || !(kcal > 0)) return null;

  const protein = median(
    clean.map((h) => per100Macro(h, "protein")).filter((n): n is number => n !== undefined),
  );
  const fat = median(
    clean.map((h) => per100Macro(h, "fat")).filter((n): n is number => n !== undefined),
  );
  const carbs = median(
    clean.map((h) => per100Macro(h, "carbs")).filter((n): n is number => n !== undefined),
  );
  const fiber = median(
    clean.map((h) => per100Macro(h, "fiber")).filter((n): n is number => n !== undefined),
  );
  const sugar = median(
    clean.map((h) => per100Macro(h, "sugar")).filter((n): n is number => n !== undefined),
  );

  return scaleFromPer100(
    { calories: kcal, protein, fat, carbs, fiber, sugar },
    portionGrams,
    trimmed,
  );
}

/**
 * Median of matching OFF products for a generic staple query.
 * Returns null when fewer than 2 clean hits (not enough to average).
 */
export async function averageOpenFoodFactsStaple(
  query: string,
  options?: { portionGrams?: number; minHits?: number },
): Promise<PackNutrition | null> {
  const trimmed = query.trim();
  if (trimmed.length < 3) return null;
  const candidates = await searchOpenFoodFactsCandidates(trimmed, 10);
  return averagePackNutritionHits(trimmed, candidates, options);
}
