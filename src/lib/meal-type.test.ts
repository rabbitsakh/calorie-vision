import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { hourInTimezone, inferMealTypeFromHour } from "./meal-type";

describe("inferMealTypeFromHour", () => {
  test("maps day parts to meal slots", () => {
    assert.equal(inferMealTypeFromHour(7), "BREAKFAST");
    assert.equal(inferMealTypeFromHour(12), "LUNCH");
    assert.equal(inferMealTypeFromHour(19), "DINNER");
    assert.equal(inferMealTypeFromHour(16), "SNACK");
    assert.equal(inferMealTypeFromHour(3), "SNACK");
    assert.equal(inferMealTypeFromHour(22), "SNACK");
  });

  test("normalizes out-of-range hours", () => {
    assert.equal(inferMealTypeFromHour(24), "SNACK");
    assert.equal(inferMealTypeFromHour(-1), "SNACK"); // wraps to 23
  });
});

describe("hourInTimezone", () => {
  test("falls back to local hour without timezone", () => {
    const date = new Date("2026-06-15T12:30:00Z");
    assert.equal(hourInTimezone(date, null), date.getHours());
  });

  test("reads Moscow hour", () => {
    const date = new Date("2026-06-15T09:00:00Z"); // 12:00 MSK
    assert.equal(hourInTimezone(date, "Europe/Moscow"), 12);
  });
});
