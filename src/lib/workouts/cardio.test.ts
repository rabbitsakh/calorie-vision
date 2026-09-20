import assert from "node:assert/strict";
import { test } from "node:test";
import {
  formatDuration,
  formatPace,
  parseDistanceKm,
  parseDurationToSec,
  paceSecPerKm,
  cardioSetTotals,
} from "./cardio.ts";
import { defaultExerciseKind, parseExerciseKind } from "./exercise-kind.ts";

test("parseDurationToSec accepts mm:ss and minutes", () => {
  assert.equal(parseDurationToSec("28:12"), 28 * 60 + 12);
  assert.equal(parseDurationToSec("1:02:03"), 3723);
  assert.equal(parseDurationToSec("30"), 1800);
  assert.equal(parseDurationToSec("30.5"), 1830);
  assert.equal(parseDurationToSec(""), null);
});

test("pace and cardio totals", () => {
  assert.equal(paceSecPerKm(5, 1800), 360);
  assert.equal(formatPace(360), "6:00/км");
  assert.equal(formatDuration(3723), "1:02:03");
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
