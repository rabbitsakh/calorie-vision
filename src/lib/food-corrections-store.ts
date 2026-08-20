import {
  applyFoodCorrection,
  foodCorrectionKey,
  mergeRememberedCorrection,
  pickFoodCorrection,
  type RememberFoodCorrectionInput,
} from "@/lib/food-corrections";
import type { FoodRecognitionResult } from "@/lib/food-types";
import { prisma } from "@/lib/prisma";

/** Legacy/global corrections use empty userId so they remain shareable. */
export const GLOBAL_CORRECTION_USER_ID = "";

const CACHE_TTL_MS = 60_000;
const cacheByUser = new Map<
  string,
  { rows: Awaited<ReturnType<typeof loadCorrectionRows>>; at: number }
>();

async function loadCorrectionRows(userId: string) {
  return prisma.foodCorrection.findMany({
    where:
      userId && userId !== GLOBAL_CORRECTION_USER_ID
        ? { OR: [{ userId }, { userId: GLOBAL_CORRECTION_USER_ID }] }
        : { userId: GLOBAL_CORRECTION_USER_ID },
    orderBy: [{ useCount: "desc" }, { updatedAt: "desc" }],
    take: 500,
    select: {
      userId: true,
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

async function getCorrectionRows(userId: string) {
  const cacheKey = userId || GLOBAL_CORRECTION_USER_ID;
  const cached = cacheByUser.get(cacheKey);
  if (cached && Date.now() - cached.at < CACHE_TTL_MS) {
    return cached.rows;
  }

  const rows = await loadCorrectionRows(userId);
  // Prefer the current user's rows before global ones when matching.
  rows.sort((a, b) => {
    const aUser = a.userId === userId ? 0 : 1;
    const bUser = b.userId === userId ? 0 : 1;
    if (aUser !== bUser) return aUser - bUser;
    return b.useCount - a.useCount;
  });
  cacheByUser.set(cacheKey, { rows, at: Date.now() });
  return rows;
}

export function invalidateFoodCorrectionCache(userId?: string): void {
  if (userId === undefined) {
    cacheByUser.clear();
    return;
  }
  cacheByUser.delete(userId || GLOBAL_CORRECTION_USER_ID);
}

export async function applyStoredFoodCorrection(
  result: FoodRecognitionResult,
  userId?: string | null,
): Promise<FoodRecognitionResult> {
  const rows = await getCorrectionRows(userId ?? GLOBAL_CORRECTION_USER_ID);
  const correction = pickFoodCorrection(result.dishName, rows);
  if (!correction) {
    return result;
  }

  return applyFoodCorrection(result, correction);
}

export async function lookupStoredFoodCorrection(
  dishName: string,
  userId?: string | null,
): Promise<FoodRecognitionResult | null> {
  const rows = await getCorrectionRows(userId ?? GLOBAL_CORRECTION_USER_ID);
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

export async function rememberFoodCorrection(
  input: RememberFoodCorrectionInput & { userId: string },
): Promise<void> {
  const originalKey = foodCorrectionKey(input.originalDish);
  const correctedKey = foodCorrectionKey(input.dishName);
  if (!originalKey || !correctedKey) {
    return;
  }

  const userId = input.userId.trim() || GLOBAL_CORRECTION_USER_ID;

  const existing = await prisma.foodCorrection.findUnique({
    where: {
      userId_originalKey: { userId, originalKey },
    },
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
    where: {
      userId_originalKey: { userId, originalKey },
    },
    create: {
      userId,
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

  invalidateFoodCorrectionCache(userId);
}
