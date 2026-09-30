import assert from "node:assert/strict";
import { test } from "node:test";
import {
  estimateDayWorkoutBurnKcal,
  estimateSessionBurnKcal,
  formatWorkoutBurnHint,
} from "./workout-day-burn.ts";

test("estimateSessionBurnKcal uses cardio minutes", () => {
  const kcal = estimateSessionBurnKcal({
    cardioDurationSec: 30 * 60,
    cardioOnly: true,
    endedAt: "2026-09-30T10:00:00.000Z",
  });
  assert.equal(kcal, 240);
});

test("estimateSessionBurnKcal uses elapsed for strength", () => {
  const kcal = estimateSessionBurnKcal({
    elapsedSec: 40 * 60,
    totalLoad: 2000,
    setCount: 12,
    endedAt: "2026-09-30T10:00:00.000Z",
  });
  assert.equal(kcal, 200);
});

test("estimateDayWorkoutBurnKcal sums sessions", () => {
  const total = estimateDayWorkoutBurnKcal([
    { cardioDurationSec: 20 * 60, cardioOnly: true, endedAt: "x" },
    { elapsedSec: 30 * 60, endedAt: "y" },
  ]);
  assert.equal(total, 160 + 150);
});

test("formatWorkoutBurnHint", () => {
  assert.equal(formatWorkoutBurnHint(0, 0), null);
  assert.match(formatWorkoutBurnHint(200, 1) ?? "", /зал ~200/);
  assert.match(formatWorkoutBurnHint(0, 2) ?? "", /2 тренировки/);
});
