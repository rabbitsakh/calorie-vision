import assert from "node:assert/strict";
import { test } from "node:test";
import {
  formatWeightDayConflictPrompt,
  isWeightDayConflictPayload,
  weightsDiffer,
} from "./weight-day-conflict.ts";

test("weightsDiffer ignores sub-0.05 noise", () => {
  assert.equal(weightsDiffer(78.5, 78.5), false);
  assert.equal(weightsDiffer(78.5, 78.54), false);
  assert.equal(weightsDiffer(78.5, 78.6), true);
  assert.equal(weightsDiffer(80, 79.9), true);
});

test("formatWeightDayConflictPrompt is Russian and strips .0", () => {
  assert.equal(
    formatWeightDayConflictPrompt(78, 78.5),
    "Сегодня уже записано 78 кг. Заменить на 78.5 кг?",
  );
});

test("isWeightDayConflictPayload validates shape", () => {
  assert.equal(isWeightDayConflictPayload(null), false);
  assert.equal(isWeightDayConflictPayload({ error: "x" }), false);
  assert.equal(
    isWeightDayConflictPayload({
      error: "На этот день уже есть запись веса",
      conflict: {
        id: "w1",
        date: "2026-08-24",
        weightKg: 78.5,
        measuredAt: "2026-08-24T07:00:00.000Z",
      },
    }),
    true,
  );
});
