import assert from "node:assert/strict";
import { test } from "node:test";
import { formatMacro, nutritionBaseline, scaleNutritionByPortion } from "./nutrition.ts";

test("scales calories and macros when portion doubles", () => {
  const scaled = scaleNutritionByPortion(
    {
      calories: 400,
      protein: 20,
      fat: 10,
      carbs: 40,
      portionGrams: 200,
    },
    400,
  );

  assert.deepEqual(scaled, {
    calories: 800,
    protein: 40,
    fat: 20,
    carbs: 80,
    portionGrams: 400,
  });
});

test("scales from a stable baseline while typing intermediate portion values", () => {
  const baseline = {
    calories: 400,
    protein: 20,
    fat: 10,
    carbs: 40,
    portionGrams: 200,
  };

  assert.equal(scaleNutritionByPortion(baseline, 1)?.calories, 2);
  assert.equal(scaleNutritionByPortion(baseline, 15)?.calories, 30);
  assert.equal(scaleNutritionByPortion(baseline, 150)?.calories, 300);
});

test("rounds macros to one decimal place", () => {
  const scaled = scaleNutritionByPortion(
    {
      calories: 100,
      protein: 1,
      fat: 1,
      carbs: 1,
      portionGrams: 100,
    },
    33,
  );

  assert.equal(scaled?.calories, 33);
  assert.equal(scaled?.protein, 0.3);
  assert.equal(formatMacro(scaled?.protein ?? 0), "0.3");
});

test("returns null for empty or invalid portion input", () => {
  const baseline = { calories: 400, portionGrams: 200, protein: 20, fat: 10, carbs: 40 };
  assert.equal(scaleNutritionByPortion(baseline, 0), null);
  assert.equal(scaleNutritionByPortion(baseline, Number.NaN), null);
  assert.equal(nutritionBaseline({ calories: 400, portionGrams: 0 }), null);
});

test("leaves missing macros undefined instead of turning them into zero", () => {
  const scaled = scaleNutritionByPortion(
    {
      calories: 250,
      portionGrams: 100,
    },
    50,
  );

  assert.deepEqual(scaled, {
    calories: 125,
    portionGrams: 50,
    protein: undefined,
    fat: undefined,
    carbs: undefined,
  });
});
