import type { FoodRecognitionResult } from "./food-types";

export type FoodCorrectionRecord = {
  correctedName: string;
  calories: number;
  protein?: number | null;
  fat?: number | null;
  carbs?: number | null;
  fiber?: number | null;
  sugar?: number | null;
  portionGrams?: number | null;
  useCount: number;
};

export type RememberFoodCorrectionInput = {
  originalDish: string;
  dishName: string;
  calories: number;
  protein?: number | null;
  fat?: number | null;
  carbs?: number | null;
  fiber?: number | null;
  sugar?: number | null;
  portionGrams?: number | null;
  originalCalories?: number | null;
  originalProtein?: number | null;
  originalFat?: number | null;
  originalCarbs?: number | null;
  originalFiber?: number | null;
  originalSugar?: number | null;
};

/** Stable key for matching a misrecognized dish name. */
export function foodCorrectionKey(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/ё/g, "е")
    .replace(/[^\p{L}\p{N}\s%]/gu, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 191);
}

function correctionTokens(name: string): string[] {
  return foodCorrectionKey(name)
    .split(" ")
    .filter((token) => token.length >= 3);
}

/** Token overlap 0..1 for fuzzy correction lookup. */
export function correctionTokenOverlap(a: string, b: string): number {
  const left = correctionTokens(a);
  const right = correctionTokens(b);
  if (left.length === 0 || right.length === 0) {
    return 0;
  }
  const rightSet = new Set(right);
  const shared = left.filter((token) => rightSet.has(token)).length;
  return shared / Math.max(left.length, right.length);
}

export function pickFoodCorrection(
  dishName: string,
  records: Array<FoodCorrectionRecord & { originalKey: string }>,
): FoodCorrectionRecord | null {
  const key = foodCorrectionKey(dishName);
  if (!key) {
    return null;
  }

  const exact = records.find((row) => row.originalKey === key);
  if (exact) {
    return exact;
  }

  let best: (FoodCorrectionRecord & { originalKey: string }) | null = null;
  let bestScore = 0;

  for (const row of records) {
    if (row.originalKey.length < 4) {
      continue;
    }
    if (key.includes(row.originalKey) || row.originalKey.includes(key)) {
      const shorter = Math.min(key.length, row.originalKey.length);
      const longer = Math.max(key.length, row.originalKey.length);
      const ratio = shorter / longer;
      if (ratio >= 0.5 && shorter > bestScore) {
        best = row;
        bestScore = shorter;
      }
      continue;
    }

    const overlap = correctionTokenOverlap(key, row.originalKey);
    if (overlap >= 0.66 && overlap > bestScore) {
      best = row;
      bestScore = overlap;
    }
  }

  return best;
}

export function applyFoodCorrection(
  result: FoodRecognitionResult,
  correction: FoodCorrectionRecord,
): FoodRecognitionResult {
  return {
    ...result,
    dishName: correction.correctedName,
    calories: correction.calories,
    protein: correction.protein ?? undefined,
    fat: correction.fat ?? undefined,
    carbs: correction.carbs ?? undefined,
    fiber: correction.fiber ?? undefined,
    sugar: correction.sugar ?? undefined,
    portionGrams: correction.portionGrams ?? result.portionGrams,
    confidence: Math.max(result.confidence, 0.85),
    source: "correction-memory",
    alternatives: undefined,
  };
}

export function mergeRememberedCorrection(
  existing: FoodCorrectionRecord | null,
  input: RememberFoodCorrectionInput,
): FoodCorrectionRecord {
  const next: FoodCorrectionRecord = {
    correctedName: input.dishName.trim(),
    calories: Math.round(input.calories),
    protein: input.protein ?? null,
    fat: input.fat ?? null,
    carbs: input.carbs ?? null,
    fiber: input.fiber ?? null,
    sugar: input.sugar ?? null,
    portionGrams: input.portionGrams ?? null,
    useCount: 1,
  };

  if (!existing) {
    return next;
  }

  const sameName = foodCorrectionKey(existing.correctedName) === foodCorrectionKey(next.correctedName);
  if (!sameName) {
    return { ...next, useCount: existing.useCount + 1 };
  }

  // Large calorie deviation (>20%) = deliberate override, not random noise — use new value directly
  const calorieDiff = Math.abs(next.calories - existing.calories);
  const isLargeDeviation = existing.calories > 0 && calorieDiff / existing.calories > 0.2;
  if (isLargeDeviation) {
    return { ...next, useCount: existing.useCount + 1 };
  }

  const weight = Math.min(existing.useCount, 20);
  const blend = (prev: number | null | undefined, value: number | null | undefined): number | null => {
    if (value === null || value === undefined) {
      return prev ?? null;
    }
    if (prev === null || prev === undefined) {
      return value;
    }
    return Math.round(((prev * weight + value) / (weight + 1)) * 10) / 10;
  };

  return {
    correctedName: next.correctedName,
    calories: Math.round((existing.calories * weight + next.calories) / (weight + 1)),
    protein: blend(existing.protein, next.protein),
    fat: blend(existing.fat, next.fat),
    carbs: blend(existing.carbs, next.carbs),
    fiber: blend(existing.fiber, next.fiber),
    sugar: blend(existing.sugar, next.sugar),
    portionGrams:
      next.portionGrams !== null && next.portionGrams !== undefined
        ? Math.round(((existing.portionGrams ?? next.portionGrams) * weight + next.portionGrams) / (weight + 1))
        : existing.portionGrams ?? null,
    useCount: existing.useCount + 1,
  };
}
