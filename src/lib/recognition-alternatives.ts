import type { FoodRecognitionResult } from "@/lib/food-types";
import type { PackNutrition } from "@/lib/open-food-facts";
import { lookupRuNutritionTable } from "@/lib/ru-nutrition-lookup";

type Alternative = NonNullable<FoodRecognitionResult["alternatives"]>[number];

export function alternativeNeedsMacroBackfill(alt: Alternative): boolean {
  if (!(alt.calories > 0)) {
    return false;
  }
  const macroCount = [alt.protein, alt.fat, alt.carbs].filter(
    (value) => value !== undefined && Number.isFinite(value),
  ).length;
  return macroCount < 2;
}

function scaleMacro(value: number | undefined, ratio: number): number | undefined {
  if (value === undefined || !Number.isFinite(value)) {
    return undefined;
  }
  return Math.round(value * ratio * 10) / 10;
}

export function backfillAlternativeFromPack(alt: Alternative, pack: PackNutrition): Alternative {
  const ratio = pack.calories > 0 && alt.calories > 0 ? alt.calories / pack.calories : 1;

  return {
    ...alt,
    protein: alt.protein ?? scaleMacro(pack.protein, ratio),
    fat: alt.fat ?? scaleMacro(pack.fat, ratio),
    carbs: alt.carbs ?? scaleMacro(pack.carbs, ratio),
    fiber: alt.fiber ?? scaleMacro(pack.fiber, ratio),
    sugar: alt.sugar ?? scaleMacro(pack.sugar, ratio),
    portionGrams: alt.portionGrams ?? pack.portionGrams,
  };
}

/** Fill missing alternative macros from the offline RU staples table (#8). */
export function enrichAlternativesFromRuTable(
  result: FoodRecognitionResult,
): FoodRecognitionResult {
  if (!result.alternatives?.length) {
    return result;
  }

  const alternatives = result.alternatives.map((alt) => {
    if (!alternativeNeedsMacroBackfill(alt)) {
      return alt;
    }
    const pack = lookupRuNutritionTable(alt.dishName);
    if (!pack) {
      return alt;
    }
    return backfillAlternativeFromPack(alt, pack);
  });

  return { ...result, alternatives };
}
