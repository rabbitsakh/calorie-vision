import assert from "node:assert/strict";
import { test } from "node:test";
import {
  inferPer100gValues,
  normalizeRecognitionNutrition,
  needsNutritionLookup,
} from "./recognition-nutrition.ts";

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

test("scales per-100 ml beer values to a 500 ml bottle", () => {
  const normalized = normalizeRecognitionNutrition({
    dishName: "Пиво Konix Пресли светлое нефильтрованное",
    calories: 45,
    protein: 0.6,
    fat: 0,
    carbs: 4.7,
    portionGrams: 500,
    confidence: 0.85,
    photoKind: "meal",
    source: "gigachat-lookup",
  });

  assert.equal(normalized.calories, 225);
  assert.equal(normalized.portionGrams, 500);
  assert.equal(normalized.carbs, 23.5);
  assert.equal(normalized.protein, 3);
});

test("keeps totals that already match the portion weight", () => {
  const normalized = normalizeRecognitionNutrition({
    dishName: "Паста с морепродуктами",
    calories: 520,
    protein: 24,
    fat: 12,
    carbs: 60,
    confidence: 0.7,
    photoKind: "meal",
    portionGrams: 250,
  });

  assert.equal(normalized.calories, 520);
  assert.equal(normalized.portionGrams, 250);
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

test("infers per-100g source for low-density drinks", () => {
  const inferred = inferPer100gValues(
    { protein: 0.6, fat: 0, carbs: 4.7 },
    45,
    500,
  );

  assert.equal(inferred?.calories, 45);
  assert.equal(inferred?.carbs, 4.7);
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
