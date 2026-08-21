import type { FoodRecognitionResult } from "@/lib/food-types";
import { looksLikeDrinkName } from "@/lib/portion-unit";

const TYPICAL_BOTTLE_ML = new Set([200, 250, 330, 350, 450, 500, 750, 1000]);

function hasDrinkVolume(result: FoodRecognitionResult): boolean {
  const g = result.portionGrams ?? 0;
  return g >= 100 && g <= 2000;
}

function hasDrinkMacros(result: FoodRecognitionResult): boolean {
  return result.calories > 0;
}

/** Whether a drink/bottle specialist pass is worth another call. */
export function shouldRunDrinkPass(result: FoodRecognitionResult): boolean {
  const nameLooksDrink = looksLikeDrinkName(result.dishName, result.brand);
  if (!nameLooksDrink) return false;

  // Already has a sensible volume and calories — skip.
  if (hasDrinkVolume(result) && hasDrinkMacros(result)) {
    const g = result.portionGrams ?? 0;
    // 100 g is a common wrong default for bottles — still worth a pass.
    if (g !== 100) return false;
  }

  return true;
}

export function isBetterDrinkResult(
  current: FoodRecognitionResult,
  candidate: FoodRecognitionResult,
): boolean {
  const score = (r: FoodRecognitionResult) => {
    let s = 0;
    if (looksLikeDrinkName(r.dishName, r.brand)) s += 1;
    const g = r.portionGrams ?? 0;
    if (hasDrinkVolume(r)) s += 2;
    if (TYPICAL_BOTTLE_ML.has(g)) s += 1;
    if (g === 100) s -= 1;
    if (r.calories > 0) s += 2;
    if (r.sugar !== undefined) s += 1;
    if (r.brand?.trim()) s += 1;
    return s;
  };
  return score(candidate) > score(current);
}
