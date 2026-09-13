import { formatMacro, scaleNutritionByPortion, type NutritionValues } from "@/lib/nutrition";
import type { FoodRecognitionResult } from "@/lib/food-types";
import { decodeHtmlEntities } from "@/lib/html-text";
import { flattenRecognitionItems } from "@/lib/recognition-items";
import {
  nutritionBaselineFromRecognition,
  recognitionNeedsPortionRescale,
  resolveDisplayPortionGrams,
  scaleRecognitionToDisplayPortion,
} from "@/lib/recognition-nutrition";

export type ConfirmDishDraft = {
  id: string;
  original: FoodRecognitionResult;
  dishName: string;
  calories: string;
  protein: string;
  fat: string;
  carbs: string;
  fiber: string;
  sugar: string;
  portionGrams: string;
  baseline: NutritionValues | null;
};

export function draftFromRecognition(item: FoodRecognitionResult, id: string): ConfirmDishDraft {
  const baseline = nutritionBaselineFromRecognition(item);
  const portionGrams = resolveDisplayPortionGrams(item);
  const scaled = portionGrams ? scaleRecognitionToDisplayPortion(item, portionGrams) : null;

  return {
    id,
    original: item,
    dishName: decodeHtmlEntities(item.dishName),
    calories: String((scaled?.calories ?? item.calories) || ""),
    protein: (scaled?.protein ?? item.protein) !== undefined ? String(scaled?.protein ?? item.protein) : "",
    fat: (scaled?.fat ?? item.fat) !== undefined ? String(scaled?.fat ?? item.fat) : "",
    carbs: (scaled?.carbs ?? item.carbs) !== undefined ? String(scaled?.carbs ?? item.carbs) : "",
    fiber: (scaled?.fiber ?? item.fiber) !== undefined ? String(scaled?.fiber ?? item.fiber) : "",
    sugar: (scaled?.sugar ?? item.sugar) !== undefined ? String(scaled?.sugar ?? item.sugar) : "",
    portionGrams: portionGrams !== undefined ? String(portionGrams) : "",
    baseline,
  };
}

export function draftsFromRecognition(recognition: FoodRecognitionResult): ConfirmDishDraft[] {
  return flattenRecognitionItems(recognition).map((item, index) =>
    draftFromRecognition(item, `${item.dishName}-${index}`),
  );
}

function userEditedDishName(dish: ConfirmDishDraft): boolean {
  return dish.dishName.trim() !== decodeHtmlEntities(dish.original.dishName).trim();
}

/** Keep user-edited dish name when SSE enrichment updates recognition. */
export function preserveUserEdits(previous: ConfirmDishDraft, draft: ConfirmDishDraft): ConfirmDishDraft {
  if (!userEditedDishName(previous)) {
    return draft;
  }
  return { ...draft, dishName: previous.dishName };
}

/** Keep user-selected portion when SSE enrichment updates recognition. */
export function mergeOneDishDraft(previous: ConfirmDishDraft, draft: ConfirmDishDraft): ConfirmDishDraft {
  const preservedPortion = Number(previous.portionGrams);
  const incomingPortion = Number(draft.portionGrams);
  const activePortion =
    Number.isFinite(preservedPortion) && preservedPortion > 0 ? preservedPortion : incomingPortion;

  const needsRescale =
    Number.isFinite(activePortion) &&
    activePortion > 0 &&
    recognitionNeedsPortionRescale(draft.original, Number(draft.calories));

  const baseline = nutritionBaselineFromRecognition(draft.original) ?? draft.baseline;

  if (needsRescale) {
    const scaled = scaleRecognitionToDisplayPortion(draft.original, activePortion);
    return preserveUserEdits(previous, {
      ...draft,
      portionGrams: String(activePortion),
      baseline,
      calories: String(scaled.calories),
      protein: scaled.protein !== undefined ? formatMacro(scaled.protein) : draft.protein,
      fat: scaled.fat !== undefined ? formatMacro(scaled.fat) : draft.fat,
      carbs: scaled.carbs !== undefined ? formatMacro(scaled.carbs) : draft.carbs,
      fiber: scaled.fiber !== undefined ? formatMacro(scaled.fiber) : draft.fiber,
      sugar: scaled.sugar !== undefined ? formatMacro(scaled.sugar) : draft.sugar,
    });
  }

  if (
    !Number.isFinite(preservedPortion) ||
    preservedPortion <= 0 ||
    preservedPortion === incomingPortion
  ) {
    return preserveUserEdits(previous, draft);
  }

  if (!baseline) {
    return preserveUserEdits(previous, { ...draft, portionGrams: previous.portionGrams });
  }

  const scaled = scaleNutritionByPortion(baseline, preservedPortion);
  if (!scaled) {
    return preserveUserEdits(previous, { ...draft, portionGrams: previous.portionGrams, baseline });
  }

  return preserveUserEdits(previous, {
    ...draft,
    portionGrams: previous.portionGrams,
    baseline,
    calories: String(scaled.calories),
    protein: scaled.protein !== undefined ? formatMacro(scaled.protein) : draft.protein,
    fat: scaled.fat !== undefined ? formatMacro(scaled.fat) : draft.fat,
    carbs: scaled.carbs !== undefined ? formatMacro(scaled.carbs) : draft.carbs,
    fiber: scaled.fiber !== undefined ? formatMacro(scaled.fiber) : draft.fiber,
    sugar: scaled.sugar !== undefined ? formatMacro(scaled.sugar) : draft.sugar,
  });
}

export function mergeDishesFromRecognition(
  current: ConfirmDishDraft[],
  recognition: FoodRecognitionResult,
): ConfirmDishDraft[] {
  const incoming = draftsFromRecognition(recognition);
  if (current.length === 0) {
    return incoming;
  }

  if (current.length !== incoming.length) {
    const maxLen = Math.max(current.length, incoming.length);
    const merged: ConfirmDishDraft[] = [];
    for (let i = 0; i < maxLen; i++) {
      const previous = current[i];
      const draft = incoming[i];
      if (previous && draft) {
        merged.push(mergeOneDishDraft(previous, draft));
      } else if (draft) {
        merged.push(draft);
      } else if (previous) {
        merged.push(previous);
      }
    }
    return merged;
  }

  return incoming.map((draft, index) => mergeOneDishDraft(current[index]!, draft));
}
