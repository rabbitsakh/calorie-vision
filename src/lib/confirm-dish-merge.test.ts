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

test("preserveUserEdits keeps hand-edited calories against late enrichment", () => {
  const previous = draftFrom(baseItem({ calories: 200, protein: 5 }), { calories: "180", protein: "8" });
  const next = draftFrom(baseItem({ dishName: "Каша", calories: 240, protein: 6, fiber: 4 }));
  const merged = preserveUserEdits(previous, next);
  assert.equal(merged.calories, "180");
  assert.equal(merged.protein, "8");
  assert.equal(merged.fiber, next.fiber);
});

test("preserveUserEdits does not treat portion rescale as hand edit", () => {
  const item = baseItem({
    calories: 200,
    portionGrams: 200,
    protein: 10,
    fat: 4,
    carbs: 30,
    per100g: { calories: 100, protein: 5, fat: 2, carbs: 15 },
  });
  const previous = draftFrom(item, { portionGrams: "150", calories: "150", protein: "7.5", fat: "3", carbs: "22.5" });
  // Approximate what updatePortion would set — use mergeOneDishDraft path later;
  // expected from baseline*1.5: 150 kcal, 7.5p, 3f, 22.5c
  const next = draftFrom(
    baseItem({
      dishName: "Каша",
      calories: 100,
      portionGrams: 100,
      protein: 5,
      fat: 2,
      carbs: 15,
      fiber: 3,
      per100g: { calories: 100, protein: 5, fat: 2, carbs: 15, fiber: 2 },
    }),
  );
  const merged = mergeOneDishDraft(previous, next);
  assert.equal(merged.portionGrams, "150");
  assert.equal(Number(merged.calories), 150);
  // New fiber from enrichment should appear via rescale, not be blocked
  assert.ok(merged.fiber === "3" || Number(merged.fiber) > 0);
});

test("mergeOneDishDraft keeps user portion and rescales macros", () => {
  // Mimic UI updatePortion: portion + scaled macros move together.
  const previous = draftFrom(
    baseItem({
      calories: 200,
      portionGrams: 200,
      protein: 10,
      fat: 4,
      carbs: 30,
      per100g: { calories: 100, protein: 5, fat: 2, carbs: 15 },
    }),
    { portionGrams: "150", calories: "150", protein: "7.5", fat: "3", carbs: "22.5" },
  );
  const incoming = draftFrom(
    baseItem({
      dishName: "Каша",
      calories: 100,
      portionGrams: 100,
      protein: 5,
      fat: 2,
      carbs: 15,
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

test("mergeDishesFromRecognition preserveListLength does not resurrect removed dishes", () => {
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
  const merged = mergeDishesFromRecognition(current, recognition, { preserveListLength: true });
  assert.equal(merged.length, 1);
  assert.equal(merged[0]!.dishName, "Мой рис");
  assert.equal(Number(merged[0]!.calories), 250);
});