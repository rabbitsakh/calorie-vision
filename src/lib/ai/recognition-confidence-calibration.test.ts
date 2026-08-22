import assert from "node:assert/strict";
import { test } from "node:test";
import {
  buildConfidenceBuckets,
  suggestLowConfidenceThreshold,
} from "./recognition-confidence-calibration.ts";

test("buildConfidenceBuckets groups correction rate by confidence decile", () => {
  const buckets = buildConfidenceBuckets([
    { confidence: 0.52, wasCorrected: true },
    { confidence: 0.58, wasCorrected: true },
    { confidence: 0.91, wasCorrected: false },
    { confidence: 0.94, wasCorrected: false },
  ]);

  const low = buckets.find((bucket) => bucket.bucketMin === 0.5);
  const high = buckets.find((bucket) => bucket.bucketMin === 0.9);

  assert.equal(low?.count, 2);
  assert.equal(low?.correctionRate, 100);
  assert.equal(high?.count, 2);
  assert.equal(high?.correctionRate, 0);
});

test("suggestLowConfidenceThreshold flags risky low-confidence bucket", () => {
  const buckets = buildConfidenceBuckets([
    { confidence: 0.52, wasCorrected: true },
    { confidence: 0.54, wasCorrected: true },
    { confidence: 0.56, wasCorrected: true },
    { confidence: 0.58, wasCorrected: true },
    { confidence: 0.59, wasCorrected: true },
    { confidence: 0.91, wasCorrected: false },
    { confidence: 0.92, wasCorrected: false },
    { confidence: 0.93, wasCorrected: false },
    { confidence: 0.94, wasCorrected: false },
    { confidence: 0.95, wasCorrected: false },
  ]);

  assert.equal(suggestLowConfidenceThreshold(buckets, 50), 0.6);
});
