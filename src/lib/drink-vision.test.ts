import assert from "node:assert/strict";
import { test } from "node:test";
import { isBetterDrinkResult, shouldRunDrinkPass } from "./ai/drink-vision.ts";

test("drink pass runs for juice with missing volume", () => {
  assert.equal(
    shouldRunDrinkPass({
      dishName: "Апельсиновый сок",
      calories: 0,
      confidence: 0.6,
      photoKind: "package",
    }),
    true,
  );
});

test("drink pass runs when volume stuck at 100", () => {
  assert.equal(
    shouldRunDrinkPass({
      dishName: "Пиво светлое",
      calories: 150,
      confidence: 0.7,
      photoKind: "package",
      portionGrams: 100,
    }),
    true,
  );
});

test("drink pass skips solid food", () => {
  assert.equal(
    shouldRunDrinkPass({
      dishName: "Виноград",
      calories: 80,
      confidence: 0.8,
      photoKind: "meal",
      portionGrams: 150,
    }),
    false,
  );
});

test("drink pass skips when bottle volume and calories look good", () => {
  assert.equal(
    shouldRunDrinkPass({
      dishName: "Кола",
      calories: 210,
      sugar: 53,
      confidence: 0.85,
      photoKind: "package",
      portionGrams: 500,
    }),
    false,
  );
});

test("prefers candidate with typical bottle volume", () => {
  assert.equal(
    isBetterDrinkResult(
      {
        dishName: "Молоко",
        calories: 60,
        confidence: 0.5,
        photoKind: "package",
        portionGrams: 100,
      },
      {
        dishName: "Молоко 2.5%",
        brand: "Простоквашино",
        calories: 260,
        sugar: 24,
        confidence: 0.85,
        photoKind: "package",
        portionGrams: 500,
      },
    ),
    true,
  );
});
