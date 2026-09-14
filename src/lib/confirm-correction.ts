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

export type CorrectionKind = "name" | "portion" | "nutrition";

export type CorrectionKindFlags = {
  name: boolean;
  portion: boolean;
  nutrition: boolean;
};

/** Which fields the user changed vs the display-scaled recognition baseline. */
export function classifyCorrectionKinds(
  saved: ConfirmCorrectionSaved,
  original: FoodRecognitionResult,
): CorrectionKindFlags {
  const baseline = displayScaledCorrectionBaseline(original);

  const name = saved.dishName.trim() !== baseline.dishName.trim();

  const nutrition =
    !nearlyEqualNutrition(saved.calories, baseline.calories, 1) ||
    !nearlyEqualNutrition(saved.protein, baseline.protein, 0.15) ||
    !nearlyEqualNutrition(saved.fat, baseline.fat, 0.15) ||
    !nearlyEqualNutrition(saved.carbs, baseline.carbs, 0.15) ||
    !nearlyEqualNutrition(saved.fiber, baseline.fiber, 0.15) ||
    !nearlyEqualNutrition(saved.sugar, baseline.sugar, 0.15);

  let portion = false;
  const savedPortion = saved.portionGrams;
  const basePortion = baseline.portionGrams;
  if (savedPortion !== undefined && savedPortion > 0) {
    if (basePortion !== undefined && basePortion > 0) {
      portion = savedPortion !== basePortion;
    } else {
      portion = true;
    }
  }

  return { name, portion, nutrition };
}

export function correctionKindList(flags: CorrectionKindFlags): CorrectionKind[] {
  const kinds: CorrectionKind[] = [];
  if (flags.name) kinds.push("name");
  if (flags.portion) kinds.push("portion");
  if (flags.nutrition) kinds.push("nutrition");
  return kinds;
}

/**
 * True when the user changed name / nutrition / portion vs the display-scaled
 * recognition baseline (with rounding tolerance).
 */
export function wasRecognitionCorrected(
  saved: ConfirmCorrectionSaved,
  original: FoodRecognitionResult,
): boolean {
  const flags = classifyCorrectionKinds(saved, original);
  return flags.name || flags.portion || flags.nutrition;
}

/**
 * Admin aggregate from persisted meal fields (no original portion column).
 * name ← dishName vs originalDish; nutrition ← calories vs originalCalories.
 */
export function correctionKindsFromMealFields(entry: {
  dishName: string;
  originalDish?: string | null;
  calories: number;
  originalCalories?: number | null;
}): CorrectionKindFlags {
  const name =
    Boolean(entry.originalDish?.trim()) &&
    entry.dishName.trim() !== entry.originalDish!.trim();
  const nutrition =
    entry.originalCalories !== null &&
    entry.originalCalories !== undefined &&
    !nearlyEqualNutrition(entry.calories, entry.originalCalories, 1);
  return { name, portion: false, nutrition };
}

/**
 * Skip correction memory when the save is within display-rounding noise of the
 * recognition baseline (name unchanged and nutrition/portion near-equal).
 */
export function shouldRememberFoodCorrection(
  saved: ConfirmCorrectionSaved,
  original: FoodRecognitionResult,
): boolean {
  return wasRecognitionCorrected(saved, original);
}

/** Gate memory when only originalCalories/originalDish were persisted (no full vision object). */
export function shouldRememberFoodCorrectionFromFields(input: {
  dishName: string;
  calories: number;
  protein?: number | null;
  fat?: number | null;
  carbs?: number | null;
  fiber?: number | null;
  sugar?: number | null;
  portionGrams?: number | null;
  originalDish?: string | null;
  originalCalories?: number | null;
  originalProtein?: number | null;
  originalFat?: number | null;
  originalCarbs?: number | null;
  originalFiber?: number | null;
  originalSugar?: number | null;
}): boolean {
  const originalDish = input.originalDish?.trim();
  if (!originalDish) return false;

  const nameChanged = input.dishName.trim() !== originalDish;
  if (nameChanged) return true;

  if (
    input.originalCalories !== null &&
    input.originalCalories !== undefined &&
    !nearlyEqualNutrition(input.calories, input.originalCalories, 1)
  ) {
    return true;
  }

  for (const [saved, original] of [
    [input.protein, input.originalProtein],
    [input.fat, input.originalFat],
    [input.carbs, input.originalCarbs],
    [input.fiber, input.originalFiber],
    [input.sugar, input.originalSugar],
  ] as Array<[number | null | undefined, number | null | undefined]>) {
    if (
      original !== null &&
      original !== undefined &&
      saved !== null &&
      saved !== undefined &&
      !nearlyEqualNutrition(saved, original, 0.15)
    ) {
      return true;
    }
  }

  return false;
}

