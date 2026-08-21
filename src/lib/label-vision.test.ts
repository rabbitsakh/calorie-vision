import assert from "node:assert/strict";
import { test } from "node:test";
import { isBetterLabelResult, shouldRunLabelPass } from "./ai/label-vision.ts";

test("label pass runs when photoKind is label but nutrition empty", () => {
  assert.equal(
    shouldRunLabelPass({
      dishName: "Творог",
      calories: 0,
      confidence: 0.6,
      photoKind: "label",
    }),
    true,
  );
});

test("label pass skips when per100g already filled", () => {
  assert.equal(
    shouldRunLabelPass({
      dishName: "Творог",
      calories: 0,
      confidence: 0.8,
      photoKind: "label",
      per100g: { calories: 121, protein: 16, fat: 5, carbs: 3 },
    }),
    false,
  );
});

test("label pass skips non-label kinds", () => {
  assert.equal(
    shouldRunLabelPass({
      dishName: "Борщ",
      calories: 0,
      confidence: 0.5,
      photoKind: "meal",
    }),
    false,
  );
});

test("prefers candidate with readable per100g", () => {
  assert.equal(
    isBetterLabelResult(
      { dishName: "Йогурт", calories: 0, confidence: 0.5, photoKind: "label" },
      {
        dishName: "Йогурт",
        calories: 0,
        confidence: 0.85,
        photoKind: "label",
        per100g: { calories: 72, protein: 3, fat: 2, carbs: 10, sugar: 9 },
      },
    ),
    true,
  );
});
