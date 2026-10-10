/**
 * Build POST /api/meals bodies from a cached ration day (Wave R offline copy).
 */

import { shiftDateKey } from "@/lib/dates";
import { readRationDayCache } from "@/lib/ration-day-cache";
import type { SaveMealInput } from "@/lib/save-meal";
import type { MealEntry, MealType } from "@/types";

export function mealEntryToSaveInput(entry: MealEntry, toDate: string): SaveMealInput {
  return {
    date: toDate,
    dishName: entry.dishName,
    calories: entry.calories,
    protein: entry.protein ?? undefined,
    fat: entry.fat ?? undefined,
    carbs: entry.carbs ?? undefined,
    fiber: entry.fiber ?? undefined,
    sugar: entry.sugar ?? undefined,
    portionGrams: entry.portionGrams ?? undefined,
    confidence: entry.confidence ?? undefined,
    imagePath: entry.imagePath ?? undefined,
    mealType: entry.mealType ?? undefined,
    wasCorrected: entry.wasCorrected,
    originalDish: entry.originalDish ?? undefined,
    originalCalories: entry.originalCalories ?? undefined,
    recognitionSource: entry.recognitionSource ?? undefined,
    photoKind: entry.photoKind ?? undefined,
    barcode: entry.barcode ?? undefined,
    brand: entry.brand ?? undefined,
    lookupMode: entry.lookupMode ?? undefined,
  };
}

export function copyYesterdayEntriesFromCache(
  toDate: string,
  mealType?: MealType,
): SaveMealInput[] {
  const fromDate = shiftDateKey(toDate, -1);
  const cached = readRationDayCache(fromDate);
  const entries = cached?.meals?.entries ?? [];
  const filtered = mealType
    ? entries.filter((e) => e.mealType === mealType)
    : entries;
  return filtered.map((e) => mealEntryToSaveInput(e, toDate));
}

export function cachedYesterdayMealCount(toDate: string, mealType?: MealType): number {
  return copyYesterdayEntriesFromCache(toDate, mealType).length;
}
