import assert from "node:assert/strict";
import { test } from "node:test";
import {
  displayScaledCorrectionBaseline,
  nearlyEqualNutrition,
  wasRecognitionCorrected,
} from "./confirm-correction.ts";

test("nearlyEqualNutrition tolerates ±1 calorie rounding", () => {
  assert.equal(nearlyEqualNutrition(210, 209, 1), true);
  assert.equal(nearlyEqualNutrition(210, 211, 1), true);
  assert.equal(nearlyEqualNutrition(210, 212, 1), false);
});

test("displayScaledCorrectionBaseline uses bottle volume not raw 100ml", () => {
  const baseline = displayScaledCorrectionBaseline({
    dishName: "Пиво светлое 0.5 л",
    calories: 42,
    protein: 0.4,
    fat: 0,
    carbs: 4,
    confidence: 0.9,
    photoKind: "label",
    portionGrams: 100,
    per100g: { calories: 42, protein: 0.4, fat: 0, carbs: 4 },
  });
  assert.equal(baseline.portionGrams, 500);
  assert.equal(baseline.calories, 210);
  assert.ok(Math.abs((baseline.protein ?? 0) - 2) <= 0.15);
});

test("saving display-scaled values is not a false correction", () => {
  const original = {
    dishName: "Кола 0.5 л",
    calories: 42,
    protein: 0,
    fat: 0,
    carbs: 10.6,
    sugar: 10.6,
    confidence: 0.85,
    photoKind: "label",
    portionGrams: 100,
    per100g: { calories: 42, protein: 0, fat: 0, carbs: 10.6, sugar: 10.6 },
  };
  const baseline = displayScaledCorrectionBaseline(original);
  assert.equal(
    wasRecognitionCorrected(
      {
        dishName: "Кола 0.5 л",
        calories: baseline.calories,
        protein: baseline.protein,
        fat: baseline.fat,
        carbs: baseline.carbs,
        sugar: baseline.sugar,
        portionGrams: baseline.portionGrams,
      },
      original,
    ),
    false,
  );
});

test("±1 kcal vs display baseline is not a correction", () => {
  const original = {
    dishName: "Сок 1 л",
    calories: 45,
    confidence: 0.8,
    photoKind: "label",
    portionGrams: 100,
    per100g: { calories: 45, protein: 0.5, fat: 0, carbs: 10 },
  };
  const baseline = displayScaledCorrectionBaseline(original);
  assert.equal(
    wasRecognitionCorrected(
      {
        dishName: original.dishName,
        calories: baseline.calories - 1,
        protein: baseline.protein,
        fat: baseline.fat,
        carbs: baseline.carbs,
        portionGrams: baseline.portionGrams,
      },
      original,
    ),
    false,
  );
});

test("real calorie edit vs display baseline counts as correction", () => {
  const original = {
    dishName: "Сок 1 л",
    calories: 45,
    confidence: 0.8,
    photoKind: "label",
    portionGrams: 100,
    per100g: { calories: 45, protein: 0.5, fat: 0, carbs: 10 },
  };
  const baseline = displayScaledCorrectionBaseline(original);
  assert.equal(
    wasRecognitionCorrected(
      {
        dishName: original.dishName,
        calories: baseline.calories + 40,
        portionGrams: baseline.portionGrams,
      },
      original,
    ),
    true,
  );
});

test("portion change away from display volume counts as correction", () => {
  const original = {
    dishName: "Молоко 1 л",
    calories: 52,
    confidence: 0.8,
    photoKind: "package",
    portionGrams: 100,
    per100g: { calories: 52, protein: 2.8, fat: 2.5, carbs: 4.7 },
  };
  const baseline = displayScaledCorrectionBaseline(original);
  assert.equal(baseline.portionGrams, 1000);
  assert.equal(
    wasRecognitionCorrected(
      {
        dishName: original.dishName,
        calories: baseline.calories,
        portionGrams: 250,
      },
      original,
    ),
    true,
  );
});
