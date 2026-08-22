import assert from "node:assert/strict";
import { test } from "node:test";
import { isBetterPlateResult, shouldRunPlatePass } from "./ai/plate-vision.ts";

test("plate pass runs when dish name lists several foods without items", () => {
  assert.equal(
    shouldRunPlatePass({
      dishName: "Стейк, картофель, салат",
      calories: 500,
      confidence: 0.7,
      photoKind: "meal",
    }),
    true,
  );
});

test("plate pass skips when items already split", () => {
  assert.equal(
    shouldRunPlatePass({
      dishName: "Стейк, картофель",
      calories: 500,
      confidence: 0.7,
      photoKind: "meal",
      items: [
        { dishName: "Стейк", calories: 300, confidence: 0.8 },
        { dishName: "Картофель", calories: 200, confidence: 0.7 },
      ],
    }),
    false,
  );
});

test("plate pass skips single packaged product names", () => {
  assert.equal(
    shouldRunPlatePass({
      dishName: "Йогурт",
      calories: 90,
      confidence: 0.8,
      photoKind: "package",
    }),
    false,
  );
});

test("plate pass runs for mixed plate misclassified as package", () => {
  assert.equal(
    shouldRunPlatePass({
      dishName: "Стейк, картофель",
      calories: 500,
      confidence: 0.7,
      photoKind: "package",
    }),
    true,
  );
});

test("prefers candidate with more plate items", () => {
  assert.equal(
    isBetterPlateResult(
      { dishName: "Обед", calories: 400, confidence: 0.6 },
      {
        dishName: "Курица, рис",
        calories: 450,
        confidence: 0.7,
        items: [
          { dishName: "Курица", calories: 250, confidence: 0.8 },
          { dishName: "Рис", calories: 200, confidence: 0.7 },
        ],
      },
    ),
    true,
  );
  assert.equal(
    isBetterPlateResult(
      {
        dishName: "Курица, рис",
        calories: 450,
        confidence: 0.7,
        items: [
          { dishName: "Курица", calories: 250, confidence: 0.8 },
          { dishName: "Рис", calories: 200, confidence: 0.7 },
        ],
      },
      { dishName: "Обед", calories: 400, confidence: 0.6 },
    ),
    false,
  );
});
