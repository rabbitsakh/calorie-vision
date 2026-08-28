import assert from "node:assert/strict";
import { test } from "node:test";
import { buildQuickMealLogExtras } from "./quick-meal-log.ts";

test("buildQuickMealLogExtras returns meal type and eatenAt", () => {
  const extras = buildQuickMealLogExtras("2026-06-15", "Europe/Moscow");
  assert.ok(["BREAKFAST", "LUNCH", "DINNER", "SNACK"].includes(extras.mealType));
  assert.ok(extras.eatenAt);
});
