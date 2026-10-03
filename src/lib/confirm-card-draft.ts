import { inferMealTypeFromHour } from "@/lib/meal-type";
import { getRecognitionLowConfidenceThreshold } from "@/lib/ai/recognition-thresholds";
import {
  isMissingCaloriesForReview,
  isMissingMacrosForReview,
} from "@/lib/recognition-nutrition";
import type { ConfirmDishDraft } from "@/lib/confirm-dish-merge";
import type { PendingConfirmDishUi, PendingConfirmUi } from "@/lib/meal-draft-queue";
import { MEAL_TYPE_LABELS } from "@/types";

export type DishDraft = ConfirmDishDraft;

export const DEFAULT_LOW_CONFIDENCE = getRecognitionLowConfidenceThreshold();

export function parseOptionalNumber(value: string): number | undefined {
  if (value.trim() === "") {
    return undefined;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

export function serializeDishUi(dish: DishDraft): PendingConfirmDishUi {
  return {
    id: dish.id,
    dishName: dish.dishName,
    calories: dish.calories,
    protein: dish.protein,
    fat: dish.fat,
    carbs: dish.carbs,
    fiber: dish.fiber,
    sugar: dish.sugar,
    portionGrams: dish.portionGrams,
    baseline: dish.baseline,
  };
}

export function applyUiToDishes(dishes: DishDraft[], ui?: PendingConfirmUi | null): DishDraft[] {
  if (!ui?.dishes?.length) return dishes;
  const byId = new Map(ui.dishes.map((item) => [item.id, item]));
  return dishes.map((dish, index) => {
    const saved = byId.get(dish.id) ?? ui.dishes![index];
    if (!saved) return dish;
    return {
      ...dish,
      dishName: saved.dishName,
      calories: saved.calories,
      protein: saved.protein,
      fat: saved.fat,
      carbs: saved.carbs,
      fiber: saved.fiber,
      sugar: saved.sugar,
      portionGrams: saved.portionGrams,
      baseline: saved.baseline ?? dish.baseline,
    };
  });
}

export function resolveInitialMealType(
  initialMealType: string | undefined,
  ui: PendingConfirmUi | null | undefined,
): string {
  if (ui?.mealType && ui.mealType in MEAL_TYPE_LABELS) {
    return ui.mealType;
  }
  if (initialMealType && initialMealType in MEAL_TYPE_LABELS) {
    return initialMealType;
  }
  return inferMealTypeFromHour(new Date().getHours());
}

export function dishFormDisabled(saving: boolean, searchingId: string | null): boolean {
  return saving || searchingId === "all";
}

export function dishLookupDisabled(
  dishId: string,
  saving: boolean,
  searchingId: string | null,
  enriching: boolean,
): boolean {
  if (saving) return true;
  if (enriching) return false;
  if (searchingId === "all") return true;
  if (searchingId !== null && searchingId !== dishId) return false;
  return searchingId === dishId;
}

export function dishNeedsReview(
  dish: DishDraft,
  lowConfidenceThreshold: number,
): { lowConfidence: boolean; missingCalories: boolean; missingMacros: boolean } {
  return {
    lowConfidence: dish.original.confidence < lowConfidenceThreshold,
    missingCalories: isMissingCaloriesForReview(
      Number(dish.calories),
      dish.original.per100g,
    ),
    missingMacros: isMissingMacrosForReview({
      dishName: dish.dishName,
      brand: dish.original.brand,
      calories: Number(dish.calories),
      protein: Number(dish.protein) || 0,
      fat: Number(dish.fat) || 0,
      carbs: Number(dish.carbs) || 0,
    }),
  };
}
