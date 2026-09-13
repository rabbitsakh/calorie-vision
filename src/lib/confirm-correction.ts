import type { FoodRecognitionResult } from "@/lib/food-types";
import { decodeHtmlEntities } from "@/lib/html-text";
import {
  resolveDisplayPortionGrams,
  scaleRecognitionToDisplayPortion,
} from "@/lib/recognition-nutrition";

/** Saved confirm values compared against what the user actually saw. */
export type ConfirmCorrectionSaved = {
  dishName: string;
  calories: number;
  protein?: number;
  fat?: number;
  carbs?: number;
  fiber?: number;
  sugar?: number;
  portionGrams?: number;
};

export type ConfirmCorrectionBaseline = {
  dishName: string;
  calories: number;
  protein?: number;
  fat?: number;
  carbs?: number;
  fiber?: number;
  sugar?: number;
  portionGrams?: number;
};

/** ±1 kcal / ±0.15 g macro — display rounding must not count as a correction. */
export function nearlyEqualNutrition(
  a: number | undefined,
  b: number | undefined,
  tolerance: number,
): boolean {
  if (a === undefined && b === undefined) return true;
  if (a === undefined || b === undefined) return false;
  return Math.abs(a - b) <= tolerance;
}

/**
 * Baseline for wasCorrected: display-scaled calories/portion (what confirm shows),
 * not raw vision 100 ml/100 g totals.
 */
export function displayScaledCorrectionBaseline(
  original: FoodRecognitionResult,
): ConfirmCorrectionBaseline {
  const portionGrams = resolveDisplayPortionGrams(original);
  const scaled =
    portionGrams && portionGrams > 0
      ? scaleRecognitionToDisplayPortion(original, portionGrams)
      : null;

  return {
    dishName: decodeHtmlEntities(original.dishName),
    calories: scaled?.calories ?? original.calories,
    protein: scaled?.protein ?? original.protein,
    fat: scaled?.fat ?? original.fat,
    carbs: scaled?.carbs ?? original.carbs,
    fiber: scaled?.fiber ?? original.fiber,
    sugar: scaled?.sugar ?? original.sugar,
    portionGrams:
      portionGrams && portionGrams > 0
        ? portionGrams
        : original.portionGrams && original.portionGrams > 0
          ? original.portionGrams
          : undefined,
  };
}

/**
 * True when the user changed name / nutrition / portion vs the display-scaled
 * recognition baseline (with rounding tolerance).
 */
export function wasRecognitionCorrected(
  saved: ConfirmCorrectionSaved,
  original: FoodRecognitionResult,
): boolean {
  const baseline = displayScaledCorrectionBaseline(original);

  if (saved.dishName.trim() !== baseline.dishName.trim()) {
    return true;
  }

  if (!nearlyEqualNutrition(saved.calories, baseline.calories, 1)) {
    return true;
  }

  if (!nearlyEqualNutrition(saved.protein, baseline.protein, 0.15)) {
    return true;
  }
  if (!nearlyEqualNutrition(saved.fat, baseline.fat, 0.15)) {
    return true;
  }
  if (!nearlyEqualNutrition(saved.carbs, baseline.carbs, 0.15)) {
    return true;
  }
  if (!nearlyEqualNutrition(saved.fiber, baseline.fiber, 0.15)) {
    return true;
  }
  if (!nearlyEqualNutrition(saved.sugar, baseline.sugar, 0.15)) {
    return true;
  }

  const savedPortion = saved.portionGrams;
  const basePortion = baseline.portionGrams;
  if (savedPortion !== undefined && savedPortion > 0) {
    if (basePortion !== undefined && basePortion > 0) {
      if (savedPortion !== basePortion) return true;
    } else {
      return true;
    }
  }

  return false;
}
