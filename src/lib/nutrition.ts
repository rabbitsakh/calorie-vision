export type NutritionValues = {
  calories: number;
  protein?: number;
  fat?: number;
  carbs?: number;
  portionGrams: number;
};

function finiteOrUndefined(value: number | null | undefined): number | undefined {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return undefined;
  }

  return value;
}

function scaleMacro(value: number | undefined, ratio: number): number | undefined {
  if (value === undefined) {
    return undefined;
  }

  return Math.round(value * ratio * 10) / 10;
}

export function nutritionBaseline(input: {
  calories: number;
  protein?: number | null;
  fat?: number | null;
  carbs?: number | null;
  portionGrams?: number | null;
}): NutritionValues | null {
  if (!Number.isFinite(input.calories)) {
    return null;
  }

  if (
    input.portionGrams === null ||
    input.portionGrams === undefined ||
    !Number.isFinite(input.portionGrams) ||
    input.portionGrams <= 0
  ) {
    return null;
  }

  return {
    calories: input.calories,
    protein: finiteOrUndefined(input.protein),
    fat: finiteOrUndefined(input.fat),
    carbs: finiteOrUndefined(input.carbs),
    portionGrams: input.portionGrams,
  };
}

export function scaleNutritionByPortion(
  baseline: NutritionValues,
  nextPortionGrams: number,
): NutritionValues | null {
  if (!Number.isFinite(nextPortionGrams) || nextPortionGrams <= 0) {
    return null;
  }

  if (!Number.isFinite(baseline.portionGrams) || baseline.portionGrams <= 0) {
    return null;
  }

  const ratio = nextPortionGrams / baseline.portionGrams;

  return {
    portionGrams: nextPortionGrams,
    calories: Math.max(0, Math.round(baseline.calories * ratio)),
    protein: scaleMacro(baseline.protein, ratio),
    fat: scaleMacro(baseline.fat, ratio),
    carbs: scaleMacro(baseline.carbs, ratio),
  };
}

export function formatMacro(value: number): string {
  return String(Math.round(value * 10) / 10);
}
