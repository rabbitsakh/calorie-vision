import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { isIsoDateKey, isSoftWeekPerfect } from "./chest-eligibility.ts";

describe("chest-eligibility", () => {
  test("isIsoDateKey accepts calendar dates only", () => {
    assert.equal(isIsoDateKey("2026-09-14"), true);
    assert.equal(isIsoDateKey("2026-02-30"), false);
    assert.equal(isIsoDateKey("14-09-2026"), false);
    assert.equal(isIsoDateKey(""), false);
  });

  test("isSoftWeekPerfect requires full soft week ≥5 days", () => {
    assert.equal(isSoftWeekPerfect(5, 5), true);
    assert.equal(isSoftWeekPerfect(7, 7), true);
    assert.equal(isSoftWeekPerfect(4, 4), false);
    assert.equal(isSoftWeekPerfect(5, 6), false);
    assert.equal(isSoftWeekPerfect(0, 5), false);
  });
});
