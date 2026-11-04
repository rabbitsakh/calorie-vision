import assert from "node:assert/strict";
import { test } from "node:test";
import {
  structuredMealsToAssistantMeals,
  validateStructuredMeals,
} from "./assistant-meal-schema.ts";

const jelly = {
  name: "Желе из ряженки (учтено полностью)",
  grams: 120,
  unit: "г",
  kcal: 100,
  protein: 5,
  fat: 3,
  carbs: 10,
  mealSlot: "BREAKFAST",
};

test("схема принимает несколько блюд и снимает «учтено полностью»", () => {
  const parsed = validateStructuredMeals({
    meals: [
      jelly,
      {
        name: "Сырники",
        grams: 150,
        unit: "г",
        kcal: 300,
        protein: 20,
        fat: 15,
        carbs: 25,
        mealSlot: "завтрак",
      },
    ],
  });
  assert.equal(parsed.ok, true);
  if (!parsed.ok) return;
  assert.equal(parsed.meals[0]?.name, "Желе из ряженки");
  assert.equal(parsed.meals[0]?.grams, 120);
  assert.equal(parsed.meals[1]?.mealSlot, "BREAKFAST");
  const actions = structuredMealsToAssistantMeals(parsed.meals);
  assert.equal(actions[0]?.mealSlot, "BREAKFAST");
  assert.equal(actions[0]?.note, "завтрак");
});

test("0 г — это «порция не названа», а не 100 г", () => {
  const parsed = validateStructuredMeals({
    meals: [
      {
        name: "Курица",
        grams: 0,
        unit: "г",
        kcal: 250,
        protein: 30,
        fat: 12,
        carbs: 0,
        mealSlot: null,
      },
    ],
  });
  assert.equal(parsed.ok, true);
  if (!parsed.ok) return;
  assert.equal(parsed.meals[0]?.grams, null);
  const [meal] = structuredMealsToAssistantMeals(parsed.meals);
  assert.equal(meal?.grams, undefined);
});

test("битая строка и слово «исключено» вместо имени отвергают весь список", () => {
  assert.equal(
    validateStructuredMeals({
      meals: [{ name: "Гречка", kcal: 180 }],
    }).ok,
    false,
  );
  assert.equal(
    validateStructuredMeals({
      meals: [
        {
          name: "исключено из-за предпочтений",
          grams: 100,
          unit: "г",
          kcal: 80,
          protein: 1,
          fat: 1,
          carbs: 10,
          mealSlot: null,
        },
      ],
    }).ok,
    false,
  );
});

test("аргументы function calling читаются и из строки JSON", () => {
  const parsed = validateStructuredMeals({
    function_call: {
      name: "extract_meals",
      arguments: JSON.stringify({
        meals: [
          {
            name: "Молоко",
            grams: 250,
            unit: "мл",
            kcal: 130,
            protein: 7,
            fat: 5,
            carbs: 12,
            mealSlot: "SNACK",
          },
        ],
      }),
    },
  });
  assert.equal(parsed.ok, true);
  if (!parsed.ok) return;
  assert.equal(parsed.meals[0]?.unit, "мл");
  assert.equal(parsed.meals[0]?.grams, 250);
});
