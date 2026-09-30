import assert from "node:assert/strict";
import { test } from "node:test";
import { mealNeedsMacrosRepair } from "./meal-macros-repair.ts";

test("mealNeedsMacrosRepair true when kcal without BJU", () => {
  assert.equal(mealNeedsMacrosRepair({ calories: 320, protein: 0, fat: 0, carbs: 0 }), true);
  assert.equal(mealNeedsMacrosRepair({ calories: 320, protein: null, fat: null, carbs: null }), true);
});

test("mealNeedsMacrosRepair false when macros or no kcal", () => {
  assert.equal(mealNeedsMacrosRepair({ calories: 320, protein: 20, fat: 0, carbs: 0 }), false);
  assert.equal(mealNeedsMacrosRepair({ calories: 0, protein: 0, fat: 0, carbs: 0 }), false);
});
