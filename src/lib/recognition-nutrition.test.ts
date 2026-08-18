import assert from "node:assert/strict";
import { test } from "node:test";
import { normalizeRecognitionNutrition, needsNutritionLookup } from "./recognition-nutrition.ts";

test("normalizes zero calories from per100g data", () => {
  const normalized = normalizeRecognitionNutrition({
    dishName: "Творог 5%",
    calories: 0,
    confidence: 0.8,
    photoKind: "label",
    per100g: { calories: 121, protein: 16, fat: 5, carbs: 3 },
  });

  assert.equal(normalized.calories, 121);
  assert.equal(normalized.portionGrams, 100);
  assert.equal(normalized.protein, 16);
});

test("defaults meal portion grams for portion scaling", () => {
  const normalized = normalizeRecognitionNutrition({
    dishName: "Паста с морепродуктами",
    calories: 520,
    protein: 24,
    fat: 12,
    carbs: 60,
    confidence: 0.7,
    photoKind: "meal",
  });

  assert.equal(normalized.portionGrams, 250);
});

test("detects when nutrition lookup is still needed", () => {
  assert.equal(
    needsNutritionLookup({
      dishName: "Паста с морепродуктами",
      calories: 0,
      protein: 0,
      fat: 0,
      carbs: 0,
      confidence: 0.7,
      photoKind: "meal",
    }),
    true,
  );
  assert.equal(
    needsNutritionLookup({
      dishName: "Паста с морепродуктами",
      calories: 520,
      protein: 24,
      fat: 12,
      carbs: 60,
      confidence: 0.7,
      photoKind: "meal",
      portionGrams: 250,
    }),
    false,
  );
});
