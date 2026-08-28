import type { MealEntry, Prisma } from "@prisma/client";

/** Fields copied when duplicating or copying a meal (new id/timestamps, no group). */
export function mealEntryCloneData(
  source: MealEntry,
  overrides?: Partial<Prisma.MealEntryCreateInput>,
): Prisma.MealEntryCreateInput {
  return {
    userId: source.userId,
    date: source.date,
    dishName: source.dishName,
    calories: source.calories,
    protein: source.protein,
    fat: source.fat,
    carbs: source.carbs,
    fiber: source.fiber,
    sugar: source.sugar,
    portionGrams: source.portionGrams,
    confidence: source.confidence,
    imagePath: source.imagePath,
    mealType: source.mealType,
    wasCorrected: source.wasCorrected,
    originalDish: source.originalDish,
    originalCalories: source.originalCalories,
    recognitionSource: source.recognitionSource,
    photoKind: source.photoKind,
    barcode: source.barcode,
    eatenAt: source.eatenAt,
    mealGroupId: null,
    ...overrides,
  };
}
