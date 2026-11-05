import assert from "node:assert/strict";
import { test } from "node:test";
import { bestPaceDeltaSec, buildExerciseTimeline, topWeightDeltaKg } from "./timeline.ts";

test("buildExerciseTimeline tracks top weight over sessions", () => {
  const points = buildExerciseTimeline(
    [
      {
        id: "s1",
        date: "2026-09-01",
        createdAt: "2026-09-01T10:00:00Z",
        exercises: [
          {
            id: "e1",
            name: "Жим лёжа",
            kind: "strength",
            sets: [
              { weightKg: 80, reps: 8, sortOrder: 0 },
              { weightKg: 80, reps: 6, sortOrder: 1 },
            ],
          },
        ],
      },
      {
        id: "s2",
        date: "2026-09-08",
        createdAt: "2026-09-08T10:00:00Z",
        exercises: [
          {
            id: "e2",
            name: "жим лёжа",
            kind: "strength",
            sets: [
              { weightKg: 82.5, reps: 8, sortOrder: 0 },
              { weightKg: 80, reps: 8, sortOrder: 1 },
            ],
          },
        ],
      },
    ],
    "Жим лёжа",
  );

  assert.equal(points.length, 2);
  assert.equal(points[0]?.topWeightKg, 80);
  assert.equal(points[1]?.topWeightKg, 82.5);
  assert.equal(topWeightDeltaKg(points), 2.5);
});

test("buildExerciseTimeline tracks cardio distance and pace", () => {
  const points = buildExerciseTimeline(
    [
      {
        id: "c1",
        date: "2026-09-01",
        createdAt: "2026-09-01T10:00:00Z",
        exercises: [
          {
            id: "e1",
            name: "Бег",
            kind: "cardio",
            sets: [{ weightKg: null, reps: null, distanceKm: 5, durationSec: 1800, sortOrder: 0 }],
          },
        ],
      },
      {
        id: "c2",
        date: "2026-09-08",
        createdAt: "2026-09-08T10:00:00Z",
        exercises: [
          {
            id: "e2",
            name: "Бег",
            kind: "cardio",
            sets: [{ weightKg: null, reps: null, distanceKm: 5, durationSec: 1700, sortOrder: 0 }],
          },
        ],
      },
    ],
    "Бег",
  );

  assert.equal(points.length, 2);
  assert.equal(points[0]?.distanceKm, 5);
  assert.equal(points[0]?.bestPaceSecPerKm, 360);
  assert.equal(points[1]?.bestPaceSecPerKm, 340);
  assert.equal(bestPaceDeltaSec(points), -20);
});

test("chart by catalogId merges renamed duplicates into one line", () => {
  const points = buildExerciseTimeline(
    [
      {
        id: "s1",
        date: "2026-10-01",
        createdAt: "2026-10-01T10:00:00Z",
        exercises: [
          {
            id: "e1",
            name: "жим лежа",
            catalogId: "bench-press",
            kind: "strength",
            sets: [
              { weightKg: 60, reps: 10, setType: "warmup", sortOrder: 0 },
              { weightKg: 80, reps: 5, setType: "working", sortOrder: 1 },
            ],
          },
        ],
      },
      {
        id: "s2",
        date: "2026-10-08",
        createdAt: "2026-10-08T10:00:00Z",
        exercises: [
          {
            id: "e2",
            name: "Жим штанги лёжа",
            catalogId: "bench-press",
            kind: "strength",
            sets: [
              { weightKg: 100, reps: 3, setType: "working", sortOrder: 0 },
              { weightKg: 90, reps: 8, setType: "working", sortOrder: 1 },
            ],
          },
          {
            id: "e3",
            name: "Жим штанги лёжа",
            catalogId: "ohp",
            kind: "strength",
            sets: [{ weightKg: 40, reps: 10, setType: "working", sortOrder: 0 }],
          },
        ],
      },
      {
        id: "s3",
        date: "2026-10-15",
        createdAt: "2026-10-15T10:00:00Z",
        exercises: [
          {
            id: "e4",
            name: "жим лежа",
            catalogId: null,
            kind: "strength",
            sets: [{ weightKg: 70, reps: 5, setType: "working", sortOrder: 0 }],
          },
        ],
      },
    ],
    "жим лежа",
    { catalogId: "bench-press" },
  );

  assert.equal(points.length, 2);
  assert.equal(points[0]?.estimated1Rm, 93.3);
  assert.equal(points[0]?.bestSetKg, 80);
  assert.equal(points[0]?.bestSetReps, 5);
  assert.equal(points[0]?.totalLoad, 400);
  assert.equal(points[1]?.estimated1Rm, 114);
  assert.equal(points[1]?.bestSetKg, 100);
  assert.equal(points[1]?.bestSetReps, 3);
  assert.equal(points[1]?.bestSetVolume, 720);
  assert.equal(points[1]?.totalLoad, 1020);
});
