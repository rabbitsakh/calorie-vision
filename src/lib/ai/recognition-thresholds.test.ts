import assert from "node:assert/strict";
import { test } from "node:test";
import { getRecognitionLowConfidenceThreshold } from "./recognition-thresholds.ts";

test("getRecognitionLowConfidenceThreshold falls back to default", () => {
  assert.equal(getRecognitionLowConfidenceThreshold(), 0.55);
});
