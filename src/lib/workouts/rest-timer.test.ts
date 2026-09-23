import assert from "node:assert/strict";
import { test } from "node:test";
import {
  formatRestClock,
  resolveRestDuration,
  resolveRestForSet,
} from "./rest-timer.ts";

test("resolveRestDuration ignores click events and NaN", () => {
  assert.equal(resolveRestDuration(undefined, 90), 90);
  assert.equal(resolveRestDuration(120, 90), 120);
  assert.equal(resolveRestDuration({ preventDefault() {} }, 90), 90);
  assert.equal(resolveRestDuration(Number.NaN, 90), 90);
  assert.equal(resolveRestDuration(-5, 90), 90);
  assert.equal(resolveRestDuration(0, 90), 90);
});

test("formatRestClock", () => {
  assert.equal(formatRestClock(90), "1:30");
  assert.equal(formatRestClock(5), "0:05");
  assert.equal(formatRestClock(Number.NaN), "0:00");
});

test("resolveRestForSet skips warmup and shortens rest-pause", () => {
  assert.equal(resolveRestForSet({ setType: "warmup", defaultSec: 90 }), 0);
  assert.equal(resolveRestForSet({ setType: "rest_pause", defaultSec: 90, restPauseSec: 20 }), 20);
  assert.equal(resolveRestForSet({ setType: "working", defaultSec: 120 }), 120);
});
