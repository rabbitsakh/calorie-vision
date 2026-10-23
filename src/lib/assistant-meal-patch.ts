/**
 * Pure meal-patch field builder — rescale portion, apply toMealType, etc.
 * Kept free of Prisma so unit tests stay light.
 */

import type { AssistantActions } from "@/lib/admin-assistant";
import { parseMealTypeKey, type MealTypeKey } from "@/lib/assistant-meal-time";
import { nutritionBaseline, scaleNutritionByPortion } from "@/lib/nutrition";

export type MealPatchRow = {
  dishName: string;
  calories: number;
  protein: number | null;
  fat: number | null;
  carbs: number | null;
  fiber?: number | null;
  sugar?: number | null;
  portionGrams: number | null;
  mealType: string | null;
};

export type MealPatchFields = {
  dishName?: string;
  calories?: number;
  protein?: number | null;
  fat?: number | null;
  carbs?: number | null;
  fiber?: number | null;
  sugar?: number | null;
  portionGrams?: number | null;
  mealType?: MealTypeKey | null;
  eatenAt?: Date;
};

/** Resolve destination mealType from patch.toMealType (not the match filter). */
export function resolvePatchDestinationMealType(
  patch: NonNullable<AssistantActions["patchMeals"]>[number],
): MealTypeKey | null {
  return parseMealTypeKey(patch.toMealType) ?? null;
}

/**
 * Build update fields for one meal row from a patch.
 * When portionGrams changes and kcal/macros are omitted, rescale from baseline.
 */
export function buildMealPatchFields(
  row: MealPatchRow,
  patch: NonNullable<AssistantActions["patchMeals"]>[number],
  opts?: { eatenAtIso?: string | null },
): MealPatchFields | null {
  const out: MealPatchFields = {};

  if (patch.name?.trim() && patch.name.trim() !== row.dishName) {
    out.dishName = patch.name.trim().slice(0, 120);
  }

  const nextPortion =
    typeof patch.portionGrams === "number" && Number.isFinite(patch.portionGrams)
      ? Math.round(patch.portionGrams)
      : null;
  const macrosProvided =
    typeof patch.kcal === "number" ||
    typeof patch.protein === "number" ||
    typeof patch.fat === "number" ||
    typeof patch.carbs === "number";

  if (nextPortion != null && nextPortion > 0 && !macrosProvided) {
    const baseline = nutritionBaseline({
      calories: row.calories,
      protein: row.protein,
      fat: row.fat,
      carbs: row.carbs,
      fiber: row.fiber,
      sugar: row.sugar,
      portionGrams: row.portionGrams,
    });
    if (baseline) {
      const scaled = scaleNutritionByPortion(baseline, nextPortion);
      if (scaled) {
        out.portionGrams = scaled.portionGrams;
        out.calories = scaled.calories;
        if (scaled.protein != null) out.protein = scaled.protein;
        if (scaled.fat != null) out.fat = scaled.fat;
        if (scaled.carbs != null) out.carbs = scaled.carbs;
        if (scaled.fiber != null) out.fiber = scaled.fiber;
        if (scaled.sugar != null) out.sugar = scaled.sugar;
      } else {
        out.portionGrams = nextPortion;
      }
    } else {
      out.portionGrams = nextPortion;
    }
  } else if (nextPortion != null && nextPortion > 0) {
    out.portionGrams = nextPortion;
  }

  if (typeof patch.kcal === "number" && Number.isFinite(patch.kcal)) {
    out.calories = Math.round(patch.kcal);
  }
  if (typeof patch.protein === "number") out.protein = patch.protein;
  if (typeof patch.fat === "number") out.fat = patch.fat;
  if (typeof patch.carbs === "number") out.carbs = patch.carbs;

  const toType = resolvePatchDestinationMealType(patch);
  if (toType && toType !== row.mealType) {
    out.mealType = toType;
  }

  if (opts?.eatenAtIso) {
    out.eatenAt = new Date(opts.eatenAtIso);
  }

  return Object.keys(out).length ? out : null;
}

/** Rescale a photo draft when the user edits portion grams. */
export function scalePhotoDraftPortion(
  draft: MealPatchRow,
  nextPortionGrams: number,
): MealPatchRow {
  if (!Number.isFinite(nextPortionGrams) || nextPortionGrams <= 0) {
    return { ...draft, portionGrams: null };
  }
  const baseline = nutritionBaseline({
    calories: draft.calories,
    protein: draft.protein,
    fat: draft.fat,
    carbs: draft.carbs,
    fiber: draft.fiber,
    sugar: draft.sugar,
    portionGrams: draft.portionGrams,
  });
  if (!baseline) {
    return { ...draft, portionGrams: nextPortionGrams };
  }
  const scaled = scaleNutritionByPortion(baseline, nextPortionGrams);
  if (!scaled) {
    return { ...draft, portionGrams: nextPortionGrams };
  }
  return {
    ...draft,
    portionGrams: scaled.portionGrams,
    calories: scaled.calories,
    protein: scaled.protein ?? draft.protein,
    fat: scaled.fat ?? draft.fat,
    carbs: scaled.carbs ?? draft.carbs,
    fiber: scaled.fiber ?? draft.fiber,
    sugar: scaled.sugar ?? draft.sugar,
  };
}
