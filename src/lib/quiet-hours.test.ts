import assert from "node:assert/strict";
import { test } from "node:test";
import { clampHour, formatQuietHoursLabel, isInQuietHours } from "./quiet-hours.ts";

test("clampHour accepts 0–23", () => {
  assert.equal(clampHour(0), 0);
  assert.equal(clampHour(23), 23);
  assert.equal(clampHour("7"), 7);
  assert.equal(clampHour(24), null);
  assert.equal(clampHour(-1), null);
  assert.equal(clampHour(null), null);
});

test("isInQuietHours disabled when null or equal", () => {
  assert.equal(isInQuietHours(22, null, 7), false);
  assert.equal(isInQuietHours(22, 22, 22), false);
});

test("isInQuietHours same-day range", () => {
  assert.equal(isInQuietHours(1, 0, 7), true);
  assert.equal(isInQuietHours(7, 0, 7), false);
  assert.equal(isInQuietHours(12, 0, 7), false);
});

test("isInQuietHours wraps midnight", () => {
  assert.equal(isInQuietHours(22, 22, 7), true);
  assert.equal(isInQuietHours(23, 22, 7), true);
  assert.equal(isInQuietHours(0, 22, 7), true);
  assert.equal(isInQuietHours(6, 22, 7), true);
  assert.equal(isInQuietHours(7, 22, 7), false);
  assert.equal(isInQuietHours(12, 22, 7), false);
});

test("formatQuietHoursLabel", () => {
  assert.equal(formatQuietHoursLabel(22, 7), "22:00–07:00");
  assert.equal(formatQuietHoursLabel(null, 7), "выключены");
});
