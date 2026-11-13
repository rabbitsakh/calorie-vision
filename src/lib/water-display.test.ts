import assert from "node:assert/strict";
import { test } from "node:test";
import { formatWaterDelta, formatWaterLiters, formatWaterOf } from "./water-display.ts";

test("formatWaterOf uses one «из» line in litres", () => {
  assert.equal(formatWaterOf(700, 2500), "0,7 из 2,5 л");
  assert.equal(formatWaterOf(750, 2000), "0,7 из 2 л");
  assert.equal(formatWaterOf(1990, 2000), "1,9 из 2 л");
  assert.equal(formatWaterOf(2000, 2000), "2 из 2 л");
  assert.equal(formatWaterOf(0, 2000), "0 из 2 л");
});

test("formatWaterLiters keeps a quarter litre and drops trailing zeros", () => {
  assert.equal(formatWaterLiters(250), "0,25");
  assert.equal(formatWaterLiters(2000), "2");
  assert.equal(formatWaterLiters(2500), "2,5");
});

test("formatWaterDelta is the add-button label", () => {
  assert.equal(formatWaterDelta(250), "+0,25 л");
  assert.equal(formatWaterDelta(500), "+0,5 л");
  assert.equal(formatWaterDelta(-250), "−0,25 л");
});
