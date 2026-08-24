import assert from "node:assert/strict";
import { test } from "node:test";
import { heatmapCellTone } from "./stats-heatmap.ts";

test("heatmap tones relative to calorie target", () => {
  assert.equal(heatmapCellTone(0, 2000), "empty");
  assert.equal(heatmapCellTone(null, 2000), "empty");
  assert.equal(heatmapCellTone(1000, 2000), "under");
  assert.equal(heatmapCellTone(1800, 2000), "good");
  assert.equal(heatmapCellTone(2200, 2000), "good");
  assert.equal(heatmapCellTone(2500, 2000), "over");
});

test("heatmap without target marks logged days", () => {
  assert.equal(heatmapCellTone(0, null), "empty");
  assert.equal(heatmapCellTone(500, null), "logged");
  assert.equal(heatmapCellTone(500, 0), "logged");
});
