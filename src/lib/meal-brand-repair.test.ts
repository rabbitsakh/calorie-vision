import assert from "node:assert/strict";
import test from "node:test";
import { buildBrandRepairPatch, mealNeedsBrandRepair } from "@/lib/meal-brand-repair";

test("mealNeedsBrandRepair only for generic without brand", () => {
  assert.equal(mealNeedsBrandRepair({ lookupMode: "generic", brand: null }), true);
  assert.equal(mealNeedsBrandRepair({ lookupMode: "generic", brand: "Danone" }), false);
  assert.equal(mealNeedsBrandRepair({ lookupMode: "branded", brand: null }), false);
  assert.equal(mealNeedsBrandRepair({ lookupMode: null, brand: null }), false);
});

test("buildBrandRepairPatch upgrades brand", () => {
  const patch = buildBrandRepairPatch(
    {
      dishName: "Йогурт",
      calories: 120,
      protein: 5,
      fat: 3,
      carbs: 12,
      lookupMode: "generic",
    },
    { dishName: "Йогурт Activia", brand: "Activia", lookupMode: "branded" },
  );
  assert.ok(patch);
  assert.equal(patch!.brand, "Activia");
  assert.equal(patch!.lookupMode, "branded");
  assert.equal(patch!.calories, 120);
  assert.equal(patch!.protein, 5);
});

test("buildBrandRepairPatch rejects generic-only hits", () => {
  assert.equal(
    buildBrandRepairPatch(
      { dishName: "Йогурт", calories: 100, lookupMode: "generic" },
      { dishName: "Йогурт", lookupMode: "generic" },
    ),
    null,
  );
});
