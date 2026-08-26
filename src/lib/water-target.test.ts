import assert from "node:assert/strict";
import { test } from "node:test";
import {
  WATER_DAILY_TARGET_ML,
  resolveWaterTargetMl,
  isValidWaterTargetMl,
} from "./water-target.ts";

test("resolveWaterTargetMl falls back to 2000", () => {
  assert.equal(resolveWaterTargetMl(null), WATER_DAILY_TARGET_ML);
  assert.equal(resolveWaterTargetMl(undefined), WATER_DAILY_TARGET_ML);
  assert.equal(resolveWaterTargetMl(2500), 2500);
  assert.equal(resolveWaterTargetMl(100), WATER_DAILY_TARGET_ML);
});

test("isValidWaterTargetMl bounds", () => {
  assert.equal(isValidWaterTargetMl(500), true);
  assert.equal(isValidWaterTargetMl(6000), true);
  assert.equal(isValidWaterTargetMl(499), false);
  assert.equal(isValidWaterTargetMl(6001), false);
});
