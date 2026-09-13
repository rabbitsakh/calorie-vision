import assert from "node:assert/strict";
import { test } from "node:test";
import type { FoodRecognitionResult } from "./food-types.ts";
import {
  draftFromRecognition,
  mergeDishesFromRecognition,
  mergeOneDishDraft,
  preserveUserEdits,
  type ConfirmDishDraft,
} from "./confirm-dish-merge.ts";

function baseItem(overrides: Partial<FoodRecognitionResult> = {}): FoodRecognitionResult {
  return {
    dishName: "Каша",
    calories: 200,
    protein: 5,
    fat: 3,
    carbs: 30,
    confidence: 0.9,
    portionGrams: 200,
    ...overrides,
  };
}

function draftFrom(item: FoodRecognitionResult, patch: Partial<ConfirmDishDraft> = {}): ConfirmDishDraft {
  return { ...draftFromRecognition(item, "d1"), ...patch };
}

test("preserveUserEdits keeps custom dish name", () => {
  const previous = draftFrom(baseItem(), { dishName: "Моя каша" });
  const next = draftFrom(baseItem({ dishName: "Овсянка", calories: 220 }));
  const merged = preserveUserEdits(previous, next);
  assert.equal(merged.dishName, "Моя каша");
  assert.equal(merged.calories, next.calories);
});

test("preserveUserEdits leaves name when user did not edit", () => {
  const previous = draftFrom(baseItem({ dishName: "Каша" }));
  const next = draftFrom(baseItem({ dishName: "Овсянка", calories: 220 }));
  const merged = preserveUserEdits(previous, next);
  assert.equal(merged.dishName, "Овсянка");
});

test("mergeOneDishDraft keeps user portion and rescales macros", () => {
  const previous = draftFrom(
    baseItem({
      calories: 200,
      portionGrams: 200,
      per100g: { calories: 100, protein: 5, fat: 2, carbs: 15 },
    }),
    { portionGrams: "150" },
  );
  const incoming = draftFrom(
    baseItem({
      dishName: "Каша",
      calories: 100,
      portionGrams: 100,
      per100g: { calories: 100, protein: 5, fat: 2, carbs: 15 },
    }),
  );
  const merged = mergeOneDishDraft(previous, incoming);
  assert.equal(merged.portionGrams, "150");
  assert.equal(Number(merged.calories), 150);
});

test("mergeDishesFromRecognition merges by index and preserves extras", () => {
  const current = [
    draftFrom(baseItem({ dishName: "Рис" }), { id: "a", dishName: "Мой рис" }),
  ];
  const recognition = baseItem({
    dishName: "Обед",
    items: [
      baseItem({ dishName: "Рис", calories: 250 }),
      baseItem({ dishName: "Курица", calories: 300 }),
    ],
  });
  const merged = mergeDishesFromRecognition(current, recognition);
  assert.equal(merged.length, 2);
  assert.equal(merged[0]!.dishName, "Мой рис");
  assert.equal(merged[1]!.dishName, "Курица");
});
