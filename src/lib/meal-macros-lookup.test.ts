import assert from "node:assert/strict";
import { test } from "node:test";
import { buildMacrosRepairPatch, buildMacrosRepairQuery } from "./meal-macros-lookup.ts";

test("buildMacrosRepairQuery appends brand when missing from name", () => {
  assert.equal(
    buildMacrosRepairQuery({ dishName: "Творог 5%", brand: "Простоквашино" }),
    "Творог 5% Простоквашино",
  );
  assert.equal(
    buildMacrosRepairQuery({ dishName: "Простоквашино творог", brand: "Простоквашино" }),
    "Простоквашино творог",
  );
  assert.equal(buildMacrosRepairQuery({ dishName: "Овсянка", brand: null }), "Овсянка");
});

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

test("buildMacrosRepairPatch carries brand and lookupMode", () => {
  const patch = buildMacrosRepairPatch(
    {
      dishName: "Творог",
      calories: 120,
      portionGrams: 100,
      brand: null,
      lookupMode: null,
    },
    {
      dishName: "Творог 5%",
      calories: 120,
      protein: 16,
      fat: 5,
      carbs: 3,
      portionGrams: 100,
      brand: "Простоквашино",
      lookupMode: "branded",
    },
  );
  assert.ok(patch);
  assert.equal(patch!.brand, "Простоквашино");
  assert.equal(patch!.lookupMode, "branded");
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
