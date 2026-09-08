import assert from "node:assert/strict";
import { test } from "node:test";
import { FOOD_ADD_LONG_PRESS_MS, FOOD_ADD_MODE_OPTIONS } from "./food-add-modes.ts";

test("long-press threshold is stable", () => {
  assert.equal(FOOD_ADD_LONG_PRESS_MS, 420);
});

test("quick mode options cover photo text barcode", () => {
  assert.deepEqual(
    FOOD_ADD_MODE_OPTIONS.map((o) => o.id),
    ["photo", "text", "barcode"],
  );
  assert.equal(FOOD_ADD_MODE_OPTIONS[0]?.openCamera, true);
});
