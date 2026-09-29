import assert from "node:assert/strict";
import { test } from "node:test";
import {
  FOOD_ADD_LONG_PRESS_MS,
  FOOD_ADD_MODE_OPTIONS,
  FOOD_ADD_PHOTO_SOURCES,
  FOOD_ADD_UTILITY_OPTIONS,
  foodAddSuggestedLabel,
  suggestFoodAddAction,
} from "./food-add-modes.ts";

test("long-press threshold is stable", () => {
  assert.equal(FOOD_ADD_LONG_PRESS_MS, 420);
});

test("quick mode options cover photo text barcode with hints and icons", () => {
  assert.deepEqual(
    FOOD_ADD_MODE_OPTIONS.map((o) => o.id),
    ["photo", "text", "barcode"],
  );
  // Photo must NOT auto-open camera from the «+» grid — camera vs gallery first.
  assert.equal(FOOD_ADD_MODE_OPTIONS[0]?.openCamera, undefined);
  assert.equal(FOOD_ADD_MODE_OPTIONS[0]?.icon, "photo");
  for (const opt of FOOD_ADD_MODE_OPTIONS) {
    assert.ok(opt.label.length > 0);
    assert.ok(opt.hint.length > 0);
    assert.ok(opt.icon.length > 0);
  }
});

test("photo sources offer camera and gallery", () => {
  assert.deepEqual(
    FOOD_ADD_PHOTO_SOURCES.map((s) => s.id),
    ["camera", "gallery"],
  );
});

test("utility options cover water weight and workout", () => {
  assert.deepEqual(
    FOOD_ADD_UTILITY_OPTIONS.map((o) => o.id),
    ["water", "weight", "workout"],
  );
  for (const opt of FOOD_ADD_UTILITY_OPTIONS) {
    assert.ok(opt.label.length > 0);
    assert.ok(opt.hint.length > 0);
  }
});

test("suggestFoodAddAction maps morning weight, day/evening photo, night water — never workout", () => {
  assert.equal(suggestFoodAddAction(7), "weight");
  assert.equal(suggestFoodAddAction(10), "weight");
  assert.equal(suggestFoodAddAction(12), "photo");
  assert.equal(suggestFoodAddAction(16), "photo");
  assert.equal(suggestFoodAddAction(19), "photo");
  assert.equal(suggestFoodAddAction(20), "photo");
  assert.equal(suggestFoodAddAction(23), "water");
  assert.equal(suggestFoodAddAction(2), "water");
  assert.equal(suggestFoodAddAction(5), "weight");
  assert.equal(suggestFoodAddAction(11), "photo");
  assert.equal(suggestFoodAddAction(22), "water");
});

test("foodAddSuggestedLabel is non-empty for each action", () => {
  for (const action of ["photo", "water", "weight", "workout"] as const) {
    assert.ok(foodAddSuggestedLabel(action).length > 0);
  }
});
