import assert from "node:assert/strict";
import { test } from "node:test";
import { bumpPortion, portionStep } from "./confirm-portion-step.ts";

test("portionStep: grams and drinks", () => {
  assert.equal(portionStep(30, false), 5);
  assert.equal(portionStep(150, false), 10);
  assert.equal(portionStep(250, false), 25);
  assert.equal(portionStep(330, true), 50);
});

test("bumpPortion: snaps to round numbers", () => {
  assert.equal(bumpPortion(50, 1, false), 60);
  assert.equal(bumpPortion(50, -1, false), 45);
  assert.equal(bumpPortion(143, 1, false), 150);
  assert.equal(bumpPortion(143, -1, false), 140);
  assert.equal(bumpPortion(200, -1, false), 190);
  assert.equal(bumpPortion(330, 1, true), 350);
});

test("bumpPortion: never below one step", () => {
  assert.equal(bumpPortion(5, -1, false), 5);
  assert.equal(bumpPortion(0, -1, false), 5);
  assert.equal(bumpPortion(0, 1, false), 5);
});
