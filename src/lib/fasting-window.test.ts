import assert from "node:assert/strict";
import { test } from "node:test";
import {
  formatEatingWindowLabel,
  isOutsideEatingWindow,
} from "./fasting-window.ts";

test("isOutsideEatingWindow: disabled when null or equal", () => {
  assert.equal(isOutsideEatingWindow(10, null, 20), false);
  assert.equal(isOutsideEatingWindow(10, 12, null), false);
  assert.equal(isOutsideEatingWindow(10, 12, 12), false);
});

test("isOutsideEatingWindow: daytime eating 12–20", () => {
  assert.equal(isOutsideEatingWindow(11, 12, 20), true);
  assert.equal(isOutsideEatingWindow(12, 12, 20), false);
  assert.equal(isOutsideEatingWindow(19, 12, 20), false);
  assert.equal(isOutsideEatingWindow(20, 12, 20), true);
  assert.equal(isOutsideEatingWindow(3, 12, 20), true);
});

test("isOutsideEatingWindow: wrap midnight 20–8", () => {
  assert.equal(isOutsideEatingWindow(21, 20, 8), false);
  assert.equal(isOutsideEatingWindow(7, 20, 8), false);
  assert.equal(isOutsideEatingWindow(8, 20, 8), true);
  assert.equal(isOutsideEatingWindow(12, 20, 8), true);
});

test("formatEatingWindowLabel", () => {
  assert.equal(formatEatingWindowLabel(null, null), "выключено");
  assert.equal(formatEatingWindowLabel(12, 20), "12:00–20:00");
});
