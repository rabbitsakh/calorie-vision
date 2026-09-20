import assert from "node:assert/strict";
import { test } from "node:test";
import {
  formatDurationMinutes,
  formatPace,
  parseDistanceKm,
  parseDurationToSec,
  durationSecToMinutesInput,
  paceSecPerKm,
  cardioSetTotals,
} from "./cardio.ts";
import { defaultExerciseKind, parseExerciseKind } from "./exercise-kind.ts";

test("parseDurationToSec accepts minutes only", () => {
  assert.equal(parseDurationToSec("28"), 28 * 60);
  assert.equal(parseDurationToSec("30.5"), 1830);
  assert.equal(parseDurationToSec("28:12"), null);
  assert.equal(parseDurationToSec(""), null);
  assert.equal(parseDurationToSec("0"), null);
});

test("formatDurationMinutes and draft round-trip", () => {
  assert.equal(formatDurationMinutes(1800), "30 мин");
  assert.equal(formatDurationMinutes(1830), "30.5 мин");
  assert.equal(durationSecToMinutesInput(1800), "30");
  assert.equal(durationSecToMinutesInput(1830), "30.5");
});

test("pace and cardio totals", () => {
  assert.equal(paceSecPerKm(5, 1800), 360);
  assert.equal(formatPace(360), "6:00/км");
  assert.equal(parseDistanceKm("5,2"), 5.2);
  const totals = cardioSetTotals([
    { distanceKm: 2, durationSec: 600 },
    { distanceKm: 3, durationSec: 900 },
  ]);
  assert.equal(totals.distanceKm, 5);
  assert.equal(totals.durationSec, 1500);
  assert.equal(totals.bestPaceSecPerKm, 300);
});

test("defaultExerciseKind for cardio-only session", () => {
  assert.equal(defaultExerciseKind(["cardio"]), "cardio");
  assert.equal(defaultExerciseKind(["chest", "cardio"]), "strength");
  assert.equal(parseExerciseKind("cardio"), "cardio");
  assert.equal(parseExerciseKind("nope"), "strength");
});
