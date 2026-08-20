import assert from "node:assert/strict";
import { test } from "node:test";
import {
  inferPer100gValues,
  mergeNutritionBackfill,
  normalizeRecognitionNutrition,
  needsNutritionLookup,
  simplifyDishNameForLookup,
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

test("simplifies dish names for a second nutrition lookup", () => {
  assert.equal(
    simplifyDishNameForLookup("Паста карбонара (домашняя, большая порция)"),
    "Паста карбонара",
  );
  assert.equal(simplifyDishNameForLookup("Борщ"), null);
});

test("merges lookup nutrition onto a zero-calorie vision item and scales portion", () => {
  const merged = mergeNutritionBackfill(
    {
      dishName: "Картофель фри",
      calories: 0,
      protein: 0,
      fat: 0,
      carbs: 0,
      portionGrams: 150,
      confidence: 0.8,
      photoKind: "meal",
      source: "gigachat",
    },
    {
      dishName: "Картофель фри",
      calories: 312,
      protein: 4,
      fat: 15,
      carbs: 41,
      portionGrams: 100,
      confidence: 0.75,
      source: "openfoodfacts-search",
      photoKind: "package",
    },
  );

  assert.equal(merged.dishName, "Картофель фри");
  assert.equal(merged.portionGrams, 150);
  assert.equal(merged.calories, 468);
  assert.equal(merged.protein, 6);
  assert.equal(merged.source, "openfoodfacts-search");
  assert.equal(merged.photoKind, "meal");
});

test("keeps vision macros when only calories were missing", () => {
  const merged = mergeNutritionBackfill(
    {
      dishName: "Салат",
      calories: 0,
      protein: 3,
      fat: 8,
      carbs: 4,
      portionGrams: 120,
      confidence: 0.6,
      photoKind: "meal",
    },
    {
      dishName: "Салат Цезарь",
      calories: 180,
      protein: 10,
      fat: 12,
      carbs: 8,
      portionGrams: 120,
      confidence: 0.7,
      source: "gigachat-lookup",
    },
  );

  assert.equal(merged.calories, 180);
  assert.equal(merged.protein, 3);
  assert.equal(merged.fat, 8);
  assert.equal(merged.carbs, 4);
});
