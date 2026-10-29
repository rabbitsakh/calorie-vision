import assert from "node:assert/strict";
import { test } from "node:test";
import {
  calorieEstimateBand,
  calorieUncertaintyRatio,
  formatCalorieEstimate,
} from "./calorie-estimate-range.ts";

test("high confidence is exact", () => {
  assert.equal(calorieUncertaintyRatio(0.9), 0);
  assert.deepEqual(calorieEstimateBand(482, 0.9), { low: 482, high: 482, exact: true });
  assert.equal(formatCalorieEstimate(482, 0.9), "482 ккал");
});

test("medium confidence yields a readable band", () => {
  const band = calorieEstimateBand(500, 0.6);
  assert.equal(band.exact, false);
  assert.ok(band.low < 500 && band.high > 500);
  assert.equal(band.low % 5, 0);
  assert.equal(band.high % 5, 0);
  assert.match(formatCalorieEstimate(500, 0.6), /^\d+–\d+ ккал$/);
});

test("low confidence widens the band", () => {
  const mid = calorieEstimateBand(500, 0.65);
  const low = calorieEstimateBand(500, 0.4);
  assert.ok(low.high - low.low >= mid.high - mid.low);
});

test("empty / invalid kcal", () => {
  assert.equal(formatCalorieEstimate(0, 0.9), "— ккал");
  assert.equal(formatCalorieEstimate(Number.NaN, 0.5), "— ккал");
});
