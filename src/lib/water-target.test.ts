import assert from "node:assert/strict";
import { test } from "node:test";
import { macroWeightKg } from "./diet.ts";
import {
  WATER_DAILY_TARGET_ML,
  recommendWaterMl,
  resolveWaterTargetMl,
  isValidWaterTargetMl,
} from "./water-target.ts";

test("вода считается от веса вокруг ориентира 2,5 и 2,0 л", () => {
  assert.equal(recommendWaterMl(70, "MALE"), 2500);
  assert.equal(recommendWaterMl(60, "FEMALE"), 2000);
  assert.equal(recommendWaterMl(85, "MALE"), 3036);
  assert.equal(recommendWaterMl(70, "MALE", true), 3000);
});

test("вода от расчётного веса белка: 126,6 кг и 185 см → 102,7 кг", () => {
  const basis = macroWeightKg(126.6, "MALE", 185);
  assert.equal(basis, 102.7);
  const rest = recommendWaterMl(126.6, "MALE", false, 185);
  const train = recommendWaterMl(126.6, "MALE", true, 185);
  assert.equal(rest, Math.round(basis * (2500 / 70)));
  assert.equal(rest, 3668);
  assert.equal(train, rest + 500);
  assert.equal(train, 4168);
  assert.equal(recommendWaterMl(250, "MALE", true, 230), 6000);
});

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
