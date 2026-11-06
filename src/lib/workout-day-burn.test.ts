import assert from "node:assert/strict";
import { test } from "node:test";
import { FALLBACK_BODY_WEIGHT_KG, GENERIC_CARDIO_MET } from "./workouts/energy.ts";
import {
  estimateDayWorkoutBurnKcal,
  estimateSessionBurnKcal,
  formatWorkoutBurnHint,
} from "./workout-day-burn.ts";

test("estimateSessionBurnKcal считает кардио по MET и весу, без пола «N ккал»", () => {
  const kcal = estimateSessionBurnKcal({
    cardioDurationSec: 30 * 60,
    cardioOnly: true,
    endedAt: "2026-09-30T10:00:00.000Z",
  });
  assert.equal(kcal, Math.round((GENERIC_CARDIO_MET - 1) * FALLBACK_BODY_WEIGHT_KG * 0.5));
  assert.notEqual(kcal, 80);
});

test("estimateSessionBurnKcal: силовая по времени сессии, известный вес меняет итог", () => {
  const fallback = estimateSessionBurnKcal({
    elapsedSec: 40 * 60,
    totalLoad: 2000,
    setCount: 12,
    endedAt: "2026-09-30T10:00:00.000Z",
  });
  const weighed = estimateSessionBurnKcal({
    elapsedSec: 40 * 60,
    weightKg: 80,
    endedAt: "2026-09-30T10:00:00.000Z",
  });
  assert.equal(fallback, Math.round(4 * FALLBACK_BODY_WEIGHT_KG * (40 / 60)));
  assert.equal(weighed, Math.round(4 * 80 * (40 / 60)));
  assert.ok(weighed > fallback);
});

test("пустая завершённая сессия не получает константу", () => {
  assert.equal(estimateSessionBurnKcal({ endedAt: "2026-09-30T10:00:00.000Z" }), 0);
});

test("estimateDayWorkoutBurnKcal суммирует сессии", () => {
  const cardio = Math.round((GENERIC_CARDIO_MET - 1) * FALLBACK_BODY_WEIGHT_KG * (20 / 60));
  const strength = Math.round(4 * FALLBACK_BODY_WEIGHT_KG * 0.5);
  const total = estimateDayWorkoutBurnKcal([
    { cardioDurationSec: 20 * 60, cardioOnly: true, endedAt: "x" },
    { elapsedSec: 30 * 60, endedAt: "y" },
  ]);
  assert.equal(total, cardio + strength);
});

test("formatWorkoutBurnHint", () => {
  assert.equal(formatWorkoutBurnHint(0, 0), null);
  assert.match(formatWorkoutBurnHint(200, 1) ?? "", /зал ~200/);
  assert.match(formatWorkoutBurnHint(0, 2) ?? "", /2 тренировки/);
});
