import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  computeLongestStreak,
  computeStreakFromSet,
  shiftDateKeyUtc,
  weekStartMonday,
} from "./streak-utils.ts";

describe("shiftDateKeyUtc", () => {
  it("shifts days correctly", () => {
    assert.equal(shiftDateKeyUtc("2026-01-15", -1), "2026-01-14");
    assert.equal(shiftDateKeyUtc("2026-01-15", 1), "2026-01-16");
  });
});

describe("computeStreakFromSet", () => {
  it("counts consecutive days from today", () => {
    const set = new Set(["2026-01-13", "2026-01-14", "2026-01-15"]);
    assert.equal(computeStreakFromSet(set, "2026-01-15"), 3);
    assert.equal(computeStreakFromSet(set, "2026-01-16"), 0);
  });
});

describe("computeLongestStreak", () => {
  it("finds longest run", () => {
    assert.equal(
      computeLongestStreak(["2026-01-01", "2026-01-02", "2026-01-05", "2026-01-06"]),
      2,
    );
  });
});

describe("weekStartMonday", () => {
  it("returns Monday for a Wednesday", () => {
    // 2026-01-14 is Wednesday
    assert.equal(weekStartMonday("2026-01-14", "Europe/Moscow"), "2026-01-12");
  });
});
