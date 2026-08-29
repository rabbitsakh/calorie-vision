import assert from "node:assert/strict";
import { test } from "node:test";
import {
  confidenceShortLabel,
  formatConfidencePercent,
  getConfidenceTone,
} from "./recognition-confidence-ui.ts";

test("formatConfidencePercent clamps and rounds", () => {
  assert.equal(formatConfidencePercent(0.856), "86%");
  assert.equal(formatConfidencePercent(1.2), "100%");
  assert.equal(formatConfidencePercent(-0.1), "0%");
});

test("getConfidenceTone uses threshold bands", () => {
  assert.equal(getConfidenceTone(0.82, 0.65), "high");
  assert.equal(getConfidenceTone(0.58, 0.65), "medium");
  assert.equal(getConfidenceTone(0.4, 0.65), "low");
});

test("confidenceShortLabel maps tone", () => {
  assert.match(confidenceShortLabel("low"), /Низкая/);
});
