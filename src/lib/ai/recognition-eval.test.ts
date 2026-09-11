import assert from "node:assert/strict";
import { test } from "node:test";
import { parseFoodRecognitionResponse } from "./parse-response.ts";
import { RECOGNITION_EVAL_CASES } from "./recognition-eval-fixtures.ts";
import { evaluateRecognitionCase } from "./recognition-eval-harness.ts";
import {
  mergeNutritionBackfill,
  needsNutritionLookup,
  normalizeRecognitionNutrition,
} from "../recognition-nutrition.ts";

for (const fixture of RECOGNITION_EVAL_CASES) {
  test(`eval/${fixture.id}: ${fixture.description}`, () => {
    const result = evaluateRecognitionCase(fixture);
    assert.equal(result.passed, true, result.errors.join("; "));
  });
}

test("eval/label-per100g normalizes calories from per100g", () => {
  const parsed = parseFoodRecognitionResponse(
    RECOGNITION_EVAL_CASES.find((c) => c.id === "label-per100g")!.rawModelJson,
  );
  const labeled = normalizeRecognitionNutrition(parsed);
  assert.ok(labeled.calories >= 200);
  assert.equal(labeled.portionGrams, 180);
});

test("eval/zero-calorie item is flagged for nutrition lookup and can merge backfill", () => {
  const parsed = parseFoodRecognitionResponse(
    RECOGNITION_EVAL_CASES.find((c) => c.id === "zero-calorie-named-item")!.rawModelJson,
  );
  assert.equal(needsNutritionLookup(parsed), true);

  const merged = mergeNutritionBackfill(parsed, {
    dishName: "Картофель фри",
    calories: 312,
    protein: 4,
    fat: 15,
    carbs: 41,
    portionGrams: 100,
    confidence: 0.8,
    source: "openfoodfacts-search",
  });
  assert.equal(merged.calories, 468);
  assert.equal(merged.portionGrams, 150);
});
