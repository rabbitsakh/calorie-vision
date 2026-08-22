import assert from "node:assert/strict";
import { test } from "node:test";
import { percentile, summarizeLatencyMs } from "./recognition-percentiles.ts";

test("percentile returns median and p95", () => {
  const samples = [10, 20, 30, 40, 100];
  assert.equal(percentile(samples, 50), 30);
  assert.equal(percentile(samples, 95), 100);
});

test("summarizeLatencyMs aggregates samples", () => {
  const summary = summarizeLatencyMs([100, 200, 300, 400, 5000]);
  assert.equal(summary.count, 5);
  assert.equal(summary.p50Ms, 300);
  assert.equal(summary.p95Ms, 5000);
  assert.equal(summary.maxMs, 5000);
});
