import assert from "node:assert/strict";
import { test } from "node:test";
import { axisLabelIndices, sparseValueLabelIndices } from "./stats-chart-layout.ts";

test("axisLabelIndices caps month to 5 including ends", () => {
  const labels = axisLabelIndices(30, "month");
  assert.equal(labels.size, 5);
  assert.ok(labels.has(0));
  assert.ok(labels.has(29));
});

test("axisLabelIndices caps quarter to 4", () => {
  const labels = axisLabelIndices(90, "quarter");
  assert.equal(labels.size, 4);
  assert.ok(labels.has(0));
  assert.ok(labels.has(89));
});

test("axisLabelIndices shows all week days", () => {
  assert.equal(axisLabelIndices(7, "week").size, 7);
});

test("sparseValueLabelIndices keeps ends and extrema", () => {
  const points = [
    { index: 0, value: 140 },
    { index: 1, value: 139 },
    { index: 2, value: 138 },
    { index: 3, value: 137 },
    { index: 4, value: 136 },
    { index: 5, value: 135 },
    { index: 6, value: 141 },
  ];
  const labels = sparseValueLabelIndices(points, 4);
  assert.ok(labels.size <= 4);
  assert.ok(labels.has(0));
  assert.ok(labels.has(6));
  assert.ok(labels.has(5)); // min
  assert.ok(labels.has(6)); // max (also end)
});

test("sparseValueLabelIndices returns empty when max is 0", () => {
  assert.equal(sparseValueLabelIndices([{ index: 0, value: 1 }], 0).size, 0);
});
