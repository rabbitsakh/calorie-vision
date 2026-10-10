import assert from "node:assert/strict";
import { test } from "node:test";
import { buildEmptyOfflineRationDay } from "./offline-ration-day.ts";

test("buildEmptyOfflineRationDay has date and empty meals", () => {
  const day = buildEmptyOfflineRationDay("2026-10-09", "2026-10-10");
  assert.equal(day.date, "2026-10-09");
  assert.equal(day.today, "2026-10-10");
  assert.equal(day.meals.entries.length, 0);
  assert.equal(day.meals.totalCalories, 0);
  assert.equal(day.water.totalMl, 0);
});
