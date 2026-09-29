import assert from "node:assert/strict";
import { test } from "node:test";
import {
  adviseCardioProgression,
  adviseProgression,
  autofillNextDraft,
  bumpKg,
  isStalled,
  suggestDeloadKg,
} from "./progression.ts";

test("isStalled needs flat top weights", () => {
  assert.equal(
    isStalled([
      { date: "a", topWeightKg: 80, topReps: 5, totalLoad: 400 },
      { date: "b", topWeightKg: 80, topReps: 5, totalLoad: 400 },
      { date: "c", topWeightKg: 80, topReps: 5, totalLoad: 400 },
    ]),
    true,
  );
  assert.equal(
    isStalled([
      { date: "a", topWeightKg: 80, topReps: 5, totalLoad: 400 },
      { date: "b", topWeightKg: 82.5, topReps: 5, totalLoad: 400 },
      { date: "c", topWeightKg: 82.5, topReps: 5, totalLoad: 400 },
    ]),
    false,
  );
});

test("suggestDeloadKg and bumpKg", () => {
  assert.equal(suggestDeloadKg(100), 90);
  assert.equal(bumpKg(80, 2.5), 82.5);
});

test("adviseProgression stall → deload", () => {
  const advice = adviseProgression(
    [
      { date: "a", topWeightKg: 100, topReps: 5, totalLoad: 500 },
      { date: "b", topWeightKg: 100, topReps: 5, totalLoad: 500 },
      { date: "c", topWeightKg: 100, topReps: 5, totalLoad: 500 },
    ],
    0.05,
    100,
  );
  assert.equal(advice.kind, "stall");
  assert.equal(advice.suggestedKg, 90);
});

test("adviseCardioProgression suggests distance bump", () => {
  const advice = adviseCardioProgression({
    lastDistanceKm: 5,
    lastDurationSec: 1800,
    previousBestPaceSecPerKm: 360,
  });
  assert.equal(advice.kind, "progress");
  assert.match(advice.detail, /5\.5 км/);
});

test("adviseCardioProgression holds when pace is slower", () => {
  const advice = adviseCardioProgression({
    lastDistanceKm: 5,
    lastDurationSec: 2100,
    previousBestPaceSecPerKm: 360,
  });
  assert.equal(advice.kind, "hold");
  assert.match(advice.detail, /рекорд/i);
});

test("autofillNextDraft prefers incomplete then last", () => {
  const a = autofillNextDraft([
    { weightKg: 80, reps: 8, completed: true, setType: "working" },
    { weightKg: 82.5, reps: 8, completed: false, setType: "working" },
  ]);
  assert.equal(a?.weightKg, 82.5);
  const b = autofillNextDraft(
    [{ weightKg: 80, reps: 8, completed: true, setType: "working" }],
    { bumpAfterComplete: true, progressRate: 0.05 },
  );
  assert.equal(b?.weightKg, 84);
});
