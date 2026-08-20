import {
  applyFoodCorrection,
  foodCorrectionKey,
  mergeRememberedCorrection,
  pickFoodCorrection,
  type RememberFoodCorrectionInput,
} from "@/lib/food-corrections";
import type { FoodRecognitionResult } from "@/lib/food-types";
import { prisma } from "@/lib/prisma";

const CACHE_TTL_MS = 60_000;
let cachedRows: Awaited<ReturnType<typeof loadCorrectionRows>> | null = null;
let cachedAt = 0;

async function loadCorrectionRows() {
  return prisma.foodCorrection.findMany({
    orderBy: [{ useCount: "desc" }, { updatedAt: "desc" }],
    take: 500,
    select: {
      originalKey: true,
      correctedName: true,
      calories: true,
      protein: true,
      fat: true,
      carbs: true,
      fiber: true,
      sugar: true,
      portionGrams: true,
      useCount: true,
    },
  });
}

async function getCorrectionRows() {
  if (cachedRows && Date.now() - cachedAt < CACHE_TTL_MS) {
    return cachedRows;
  }

  cachedRows = await loadCorrectionRows();
  cachedAt = Date.now();
  return cachedRows;
}

export function invalidateFoodCorrectionCache(): void {
  cachedRows = null;
  cachedAt = 0;
}

export async function applyStoredFoodCorrection(
  result: FoodRecognitionResult,
): Promise<FoodRecognitionResult> {
  const rows = await getCorrectionRows();
  const correction = pickFoodCorrection(result.dishName, rows);
  if (!correction) {
    return result;
  }

  return applyFoodCorrection(result, correction);
}

export async function lookupStoredFoodCorrection(
  dishName: string,
): Promise<FoodRecognitionResult | null> {
  const rows = await getCorrectionRows();
  const correction = pickFoodCorrection(dishName, rows);
  if (!correction) {
    return null;
  }

  return applyFoodCorrection(
    {
      dishName,
      calories: 0,
      confidence: 0.5,
      photoKind: "meal",
    },
    correction,
  );
}

export async function rememberFoodCorrection(input: RememberFoodCorrectionInput): Promise<void> {
  const originalKey = foodCorrectionKey(input.originalDish);
  const correctedKey = foodCorrectionKey(input.dishName);
  if (!originalKey || !correctedKey) {
    return;
  }
  // Also learn when only calories/macros changed without a name change.
  // (originalKey === correctedKey is fine — we just update the nutrition values.)

  const existing = await prisma.foodCorrection.findUnique({
    where: { originalKey },
    select: {
      correctedName: true,
      calories: true,
      protein: true,
      fat: true,
      carbs: true,
      fiber: true,
      sugar: true,
      portionGrams: true,
      useCount: true,
    },
  });

  const merged = mergeRememberedCorrection(existing, input);

  await prisma.foodCorrection.upsert({
    where: { originalKey },
    create: {
      originalKey,
      correctedName: merged.correctedName,
      calories: merged.calories,
      protein: merged.protein,
      fat: merged.fat,
      carbs: merged.carbs,
      fiber: merged.fiber,
      sugar: merged.sugar,
      portionGrams: merged.portionGrams,
      useCount: merged.useCount,
    },
    update: {
      correctedName: merged.correctedName,
      calories: merged.calories,
      protein: merged.protein,
      fat: merged.fat,
      carbs: merged.carbs,
      fiber: merged.fiber,
      sugar: merged.sugar,
      portionGrams: merged.portionGrams,
      useCount: merged.useCount,
    },
  });

  invalidateFoodCorrectionCache();
}
