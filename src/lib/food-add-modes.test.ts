import assert from "node:assert/strict";
import { test } from "node:test";
import {
  FOOD_ADD_LONG_PRESS_MS,
  FOOD_ADD_MODE_OPTIONS,
  FOOD_ADD_PHOTO_SOURCES,
  FOOD_ADD_UTILITY_OPTIONS,
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
  assert.equal(FOOD_ADD_MODE_OPTIONS[0]?.primary, true);
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
