import assert from "node:assert/strict";
import { test } from "node:test";
import { parseEatenAt } from "./eaten-at.ts";
import { buildMealCreateData, validateSaveMealInput } from "./save-meal.ts";

test("parseEatenAt accepts ISO strings", () => {
  const iso = "2026-08-19T12:30:00.000Z";
  const parsed = parseEatenAt(iso);
  assert.ok(parsed instanceof Date);
  assert.equal(parsed!.toISOString(), iso);
});

test("parseEatenAt rejects invalid strings", () => {
  assert.equal(parseEatenAt("not-a-date"), undefined);
});

test("validateSaveMealInput rejects bad eatenAt", () => {
  const result = validateSaveMealInput({
    date: "2026-08-19",
    dishName: "Суп",
    calories: 200,
    eatenAt: "bad",
  });
  assert.equal(result.error, "Некорректное время приёма пищи");
});

test("buildMealCreateData stores eatenAt when provided", () => {
  const iso = "2026-08-19T09:15:00.000Z";
  const data = buildMealCreateData(
    "user-1",
    {
      date: "2026-08-19",
      dishName: "Овсянка",
      calories: 320,
      eatenAt: iso,
    },
    "2026-08-19",
  );
  assert.ok(data.eatenAt instanceof Date);
  assert.equal(data.eatenAt!.toISOString(), iso);
});
