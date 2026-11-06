import assert from "node:assert/strict";
import { test } from "node:test";
import type { FoodRecognitionResult } from "./food-types.ts";
import { draftFromRecognition } from "./confirm-dish-merge.ts";
import {
  DEFAULT_LOW_CONFIDENCE,
  dishNeedsReview,
  dishTrustedByUserEdit,
} from "./confirm-card-draft.ts";

function baseItem(overrides: Partial<FoodRecognitionResult> = {}): FoodRecognitionResult {
  return {
    dishName: "Каша",
    calories: 300,
    protein: 10,
    fat: 5,
    carbs: 50,
    confidence: 0.4,
    portionGrams: 200,
    ...overrides,
  };
}

test("dishTrustedByUserEdit detects name and macro edits", () => {
  const base = draftFromRecognition(baseItem(), "d1");
  assert.equal(dishTrustedByUserEdit(base), false);
  assert.equal(dishTrustedByUserEdit({ ...base, dishName: "Овсянка" }), true);
  assert.equal(dishTrustedByUserEdit({ ...base, calories: "350" }), true);
  assert.equal(dishTrustedByUserEdit({ ...base, protein: "18" }), true);
});

test("ноль модели оставляет калории пустыми, набранный ноль можно подтвердить", () => {
  const draft = draftFromRecognition(
    baseItem({ calories: 0, protein: 0, fat: 0, carbs: 0, portionGrams: 330 }),
    "zero",
  );
  assert.equal(draft.calories, "");
  assert.equal(draft.protein, "0");
  assert.equal(draft.fat, "0");
  assert.equal(draft.carbs, "0");
  assert.equal(dishNeedsReview(draft, DEFAULT_LOW_CONFIDENCE).missingCalories, true);
  assert.equal(
    dishNeedsReview({ ...draft, calories: "0" }, DEFAULT_LOW_CONFIDENCE).missingCalories,
    false,
  );
});

test("dishNeedsReview clears lowConfidence after user edit", () => {
  const base = draftFromRecognition(baseItem(), "d1");
  assert.equal(dishNeedsReview(base, DEFAULT_LOW_CONFIDENCE).lowConfidence, true);
  const edited = dishNeedsReview(
    { ...base, calories: "320", protein: "12" },
    DEFAULT_LOW_CONFIDENCE,
  );
  assert.equal(edited.lowConfidence, false);
});
