/** Detect soft-saved meals (kcal without BJU) that need a diary repair CTA. */

export type MacroRepairMealLike = {
  calories?: number | null;
  protein?: number | null;
  fat?: number | null;
  carbs?: number | null;
};

export function mealNeedsMacrosRepair(meal: MacroRepairMealLike): boolean {
  const kcal = Number(meal.calories) || 0;
  if (kcal <= 0) return false;
  const protein = Number(meal.protein) || 0;
  const fat = Number(meal.fat) || 0;
  const carbs = Number(meal.carbs) || 0;
  return protein <= 0 && fat <= 0 && carbs <= 0;
}
