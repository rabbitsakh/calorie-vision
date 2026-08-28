import type { Prisma } from "@prisma/client";
import { parseEatenAt } from "@/lib/eaten-at";
import { decodeHtmlEntities } from "@/lib/html-text";
import { rememberFoodCorrection } from "@/lib/food-corrections-store";
import { requireDateKey } from "@/lib/dates";

export type SaveMealInput = {
  date: string;
  dishName: string;
  calories: number;
  protein?: number;
  fat?: number;
  carbs?: number;
  fiber?: number;
  sugar?: number;
  portionGrams?: number;
  confidence?: number;
  imagePath?: string;
  mealGroupId?: string;
  mealType?: string;
  wasCorrected?: boolean;
  originalDish?: string;
  originalCalories?: number;
  originalProtein?: number;
  originalFat?: number;
  originalCarbs?: number;
  originalFiber?: number;
  originalSugar?: number;
  recognitionSource?: string;
  photoKind?: string;
  barcode?: string;
  /** ISO instant — when the meal was eaten (defaults to save time if omitted). */
  eatenAt?: string;
};

function mealTypeValue(value: string | undefined): "BREAKFAST" | "LUNCH" | "DINNER" | "SNACK" | null {
  return ["BREAKFAST", "LUNCH", "DINNER", "SNACK"].includes(value ?? "")
    ? (value as "BREAKFAST" | "LUNCH" | "DINNER" | "SNACK")
    : null;
}

export function validateSaveMealInput(body: SaveMealInput): { date: string; error?: string } {
  const date = requireDateKey(body.date);
  if (!date || !body.dishName?.trim() || !Number.isFinite(body.calories)) {
    return { date: "", error: "Укажите дату, блюдо и калорийность" };
  }
  if (body.eatenAt !== undefined && parseEatenAt(body.eatenAt) === undefined) {
    return { date: "", error: "Некорректное время приёма пищи" };
  }
  return { date };
}

export function buildMealCreateData(
  userId: string,
  body: SaveMealInput,
  date: string,
): Prisma.MealEntryCreateInput {
  const eatenAt = body.eatenAt !== undefined ? parseEatenAt(body.eatenAt) : undefined;

  return {
    user: { connect: { id: userId } },
    date,
    dishName: decodeHtmlEntities(body.dishName.trim()),
    calories: Math.round(body.calories),
    protein: body.protein,
    fat: body.fat,
    carbs: body.carbs,
    fiber: body.fiber,
    sugar: body.sugar,
    portionGrams: body.portionGrams,
    confidence: body.confidence,
    imagePath: body.imagePath?.trim() || null,
    mealGroupId: body.mealGroupId?.trim() || null,
    mealType: mealTypeValue(body.mealType),
    wasCorrected: body.wasCorrected ?? false,
    originalDish: body.originalDish ? decodeHtmlEntities(body.originalDish) : body.originalDish,
    originalCalories: body.originalCalories,
    recognitionSource: body.recognitionSource?.trim().slice(0, 64) || null,
    photoKind: body.photoKind?.trim().slice(0, 32) || null,
    barcode: body.barcode?.trim().slice(0, 32) || null,
    ...(eatenAt !== undefined && eatenAt !== null ? { eatenAt } : {}),
  };
}

export async function rememberMealCorrectionIfNeeded(
  userId: string,
  body: SaveMealInput,
): Promise<void> {
  if (!body.wasCorrected || !body.originalDish?.trim()) {
    return;
  }

  await rememberFoodCorrection({
    userId,
    originalDish: body.originalDish,
    dishName: body.dishName,
    calories: body.calories,
    protein: body.protein,
    fat: body.fat,
    carbs: body.carbs,
    fiber: body.fiber,
    sugar: body.sugar,
    portionGrams: body.portionGrams,
    originalCalories: body.originalCalories,
    originalProtein: body.originalProtein,
    originalFat: body.originalFat,
    originalCarbs: body.originalCarbs,
    originalFiber: body.originalFiber,
    originalSugar: body.originalSugar,
  });
}
