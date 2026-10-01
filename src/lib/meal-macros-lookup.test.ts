import assert from "node:assert/strict";
import { test } from "node:test";
import { buildMacrosRepairPatch } from "./meal-macros-lookup.ts";

test("buildMacrosRepairPatch scales lookup to meal portion", () => {
  const patch = buildMacrosRepairPatch(
    {
      dishName: "Овсянка",
      calories: 200,
      protein: 0,
      fat: 0,
      carbs: 0,
      portionGrams: 200,
    },
    {
      dishName: "Овсяная каша",
      calories: 100,
      protein: 4,
      fat: 2,
      carbs: 15,
      portionGrams: 100,
    },
  );
  assert.ok(patch);
  assert.equal(patch!.calories, 200);
  assert.equal(patch!.protein, 8);
  assert.equal(patch!.fat, 4);
  assert.equal(patch!.carbs, 30);
  assert.equal(patch!.portionGrams, 200);
  assert.equal(patch!.dishName, "Овсяная каша");
});

test("buildMacrosRepairPatch returns null without usable data", () => {
  assert.equal(
    buildMacrosRepairPatch(
      { dishName: "X", calories: 10, portionGrams: 100 },
      { dishName: "Y", calories: 0 },
    ),
    null,
  );
});
