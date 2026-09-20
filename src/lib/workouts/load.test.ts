import assert from "node:assert/strict";
import { test } from "node:test";
import {
  buildProgressSummary,
  exerciseLoad,
  findPreviousSession,
  loadByMuscleGroup,
  parseProgressRate,
  sessionTotalLoad,
  setLoad,
  targetLoad,
} from "./load.ts";
import { normalizeGroupKeys, sameGroupSet } from "./muscle-groups.ts";

test("set and exercise load are kg × reps", () => {
  assert.equal(setLoad({ weightKg: 80, reps: 8 }), 640);
  assert.equal(
    exerciseLoad({
      sets: [
        { weightKg: 80, reps: 8 },
        { weightKg: 80, reps: 6 },
      ],
    }),
    640 + 480,
  );
});

test("session total and split by group", () => {
  const exercises = [
    { muscleGroup: "chest", sets: [{ weightKg: 100, reps: 5 }] },
    { muscleGroup: null, sets: [{ weightKg: 40, reps: 10 }] },
  ];
  assert.equal(sessionTotalLoad(exercises), 500 + 400);
  const by = loadByMuscleGroup(exercises, ["chest", "triceps"]);
  assert.equal(by.chest, 500 + 200);
  assert.equal(by.triceps, 200);
});

test("target load applies progress rate", () => {
  assert.equal(targetLoad(1000, 0.05), 1050);
  assert.equal(parseProgressRate(5), 0.05);
  assert.equal(parseProgressRate(0.075), 0.075);
});

test("findPreviousSession prefers exact group set", () => {
  const sessions = [
    {
      id: "a",
      date: "2026-09-10",
      createdAt: "2026-09-10T10:00:00Z",
      muscleKeys: ["chest", "triceps"],
      totalLoad: 1000,
      loadByGroup: { chest: 700, triceps: 300 },
    },
    {
      id: "b",
      date: "2026-09-12",
      createdAt: "2026-09-12T10:00:00Z",
      muscleKeys: ["chest"],
      totalLoad: 800,
      loadByGroup: { chest: 800 },
    },
  ];
  const prev = findPreviousSession(sessions, ["chest", "triceps"]);
  assert.equal(prev?.id, "a");
  const summary = buildProgressSummary({
    targetGroups: ["chest", "triceps"],
    currentLoad: 1100,
    previous: prev,
    progressRate: 0.05,
  });
  assert.equal(summary.previousLoad, 1000);
  assert.equal(summary.targetLoad, 1050);
  assert.equal(summary.deltaPctVsPrevious, 10);
});

test("normalize and compare group sets", () => {
  assert.deepEqual(normalizeGroupKeys(["triceps", "chest", "chest"]), ["chest", "triceps"]);
  assert.deepEqual(normalizeGroupKeys(["other", "cardio", "legs"]), ["legs", "cardio", "other"]);
  assert.equal(sameGroupSet(["triceps", "chest"], ["chest", "triceps"]), true);
  assert.equal(sameGroupSet(["chest"], ["chest", "triceps"]), false);
  assert.equal(sameGroupSet(["cardio"], ["cardio"]), true);
});
