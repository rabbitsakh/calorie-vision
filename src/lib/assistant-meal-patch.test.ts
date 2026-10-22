import assert from "node:assert/strict";
import { test } from "node:test";
import {
  buildMealPatchFields,
  scalePhotoDraftPortion,
} from "./assistant-meal-patch.ts";

test("buildMealPatchFields rescales kcal/macros when portion changes", () => {
  const fields = buildMealPatchFields(
    {
      dishName: "Омлет",
      calories: 200,
      protein: 16,
      fat: 12,
      carbs: 4,
      fiber: null,
      sugar: null,
      portionGrams: 100,
      mealType: "BREAKFAST",
    },
    { match: "омлет", portionGrams: 200 },
  );
  assert.equal(fields?.portionGrams, 200);
  assert.equal(fields?.calories, 400);
  assert.equal(fields?.protein, 32);
  assert.equal(fields?.fat, 24);
  assert.equal(fields?.carbs, 8);
});

test("buildMealPatchFields keeps explicit kcal over rescale", () => {
  const fields = buildMealPatchFields(
    {
      dishName: "Омлет",
      calories: 200,
      protein: 16,
      fat: 12,
      carbs: 4,
      portionGrams: 100,
      mealType: "BREAKFAST",
    },
    { match: "омлет", portionGrams: 200, kcal: 250 },
  );
  assert.equal(fields?.portionGrams, 200);
  assert.equal(fields?.calories, 250);
});

test("buildMealPatchFields moves mealType via toMealType", () => {
  const fields = buildMealPatchFields(
    {
      dishName: "Суп",
      calories: 300,
      protein: 10,
      fat: 8,
      carbs: 40,
      portionGrams: 300,
      mealType: "LUNCH",
    },
    { match: "обед", mealType: "LUNCH", toMealType: "DINNER" },
  );
  assert.equal(fields?.mealType, "DINNER");
});

test("scalePhotoDraftPortion doubles macros", () => {
  const next = scalePhotoDraftPortion(
    {
      dishName: "Каша",
      calories: 150,
      protein: 5,
      fat: 3,
      carbs: 25,
      portionGrams: 100,
      mealType: null,
    },
    200,
  );
  assert.equal(next.calories, 300);
  assert.equal(next.portionGrams, 200);
  assert.equal(next.protein, 10);
});
