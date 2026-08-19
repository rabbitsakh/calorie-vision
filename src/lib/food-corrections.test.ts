import assert from "node:assert/strict";
import { test } from "node:test";
import {
  applyFoodCorrection,
  foodCorrectionKey,
  mergeRememberedCorrection,
  pickFoodCorrection,
} from "./food-corrections.ts";

test("normalizes dish names for correction lookup", () => {
  assert.equal(foodCorrectionKey("  Греческий   йогурт! "), "греческий йогурт");
  assert.equal(foodCorrectionKey("творог 5%"), "творог 5%");
});

test("applies a stored correction to recognition output", () => {
  const corrected = applyFoodCorrection(
    {
      dishName: "салат",
      calories: 120,
      confidence: 0.4,
      source: "gigachat",
    },
    {
      correctedName: "Греческий салат",
      calories: 280,
      protein: 12,
      fat: 18,
      carbs: 14,
      portionGrams: 250,
      useCount: 3,
    },
  );

  assert.equal(corrected.dishName, "Греческий салат");
  assert.equal(corrected.calories, 280);
  assert.equal(corrected.source, "correction-memory");
  assert.equal(corrected.confidence >= 0.85, true);
});

test("merges repeated corrections with running averages", () => {
  const merged = mergeRememberedCorrection(
    {
      correctedName: "Овсянка",
      calories: 300,
      protein: 10,
      fat: 5,
      carbs: 50,
      portionGrams: 250,
      useCount: 2,
    },
    {
      originalDish: "каша",
      dishName: "Овсянка",
      calories: 320,
      protein: 12,
      fat: 6,
      carbs: 52,
      portionGrams: 260,
    },
  );

  assert.equal(merged.useCount, 3);
  assert.equal(merged.calories, 307);
  assert.equal(merged.protein, 10.7);
});

test("finds partial correction matches for close names", () => {
  const picked = pickFoodCorrection("салат цезарь с курицей", [
    {
      originalKey: "салат цезарь",
      correctedName: "Цезарь с курицей",
      calories: 420,
      protein: null,
      fat: null,
      carbs: null,
      portionGrams: null,
      useCount: 1,
    },
  ]);

  assert.equal(picked?.correctedName, "Цезарь с курицей");
});
