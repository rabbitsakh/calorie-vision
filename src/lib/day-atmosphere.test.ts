import assert from "node:assert/strict";
import { test } from "node:test";
import { dayHeroAtmosphereClass, dayPartLabel } from "./day-atmosphere.ts";

test("dayHeroAtmosphereClass follows day parts", () => {
  assert.equal(dayHeroAtmosphereClass(7), "day-hero--morning");
  assert.equal(dayHeroAtmosphereClass(13), "day-hero--day");
  assert.equal(dayHeroAtmosphereClass(19), "day-hero--evening");
  assert.equal(dayHeroAtmosphereClass(23), "day-hero--night");
});

test("dayPartLabel is non-empty", () => {
  assert.ok(dayPartLabel("morning").length > 0);
  assert.ok(dayPartLabel("night").length > 0);
});
