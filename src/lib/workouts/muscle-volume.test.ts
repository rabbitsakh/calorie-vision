import assert from "node:assert/strict";
import { test } from "node:test";
import {
  buildMuscleRecoveryMap,
  recoveryStatusForGroup,
  SECONDARY_VOLUME_SHARE,
} from "./muscle-volume.ts";

const NOW = new Date("2026-11-05T18:00:00.000Z");

test("recovery windows: large 48–72h, small shorter, cardio shorter still", () => {
  const hour = 3_600_000;
  assert.equal(recoveryStatusForGroup("chest", NOW.getTime() - 10 * hour, NOW.getTime()), "loaded");
  assert.equal(recoveryStatusForGroup("back", NOW.getTime() - 60 * hour, NOW.getTime()), "recovering");
  assert.equal(recoveryStatusForGroup("legs", NOW.getTime() - 80 * hour, NOW.getTime()), "fresh");
  assert.equal(recoveryStatusForGroup("biceps", NOW.getTime() - 20 * hour, NOW.getTime()), "loaded");
  assert.equal(recoveryStatusForGroup("triceps", NOW.getTime() - 40 * hour, NOW.getTime()), "recovering");
  assert.equal(recoveryStatusForGroup("shoulders", NOW.getTime() - 50 * hour, NOW.getTime()), "fresh");
  assert.equal(recoveryStatusForGroup("cardio", NOW.getTime() - 10 * hour, NOW.getTime()), "loaded");
  assert.equal(recoveryStatusForGroup("cardio", NOW.getTime() - 30 * hour, NOW.getTime()), "recovering");
  assert.equal(recoveryStatusForGroup("cardio", NOW.getTime() - 40 * hour, NOW.getTime()), "fresh");
  assert.equal(recoveryStatusForGroup("abs", null, NOW.getTime()), "fresh");
});

test("weekly volume uses catalog primary and secondary, warmup excluded", () => {
  assert.equal(SECONDARY_VOLUME_SHARE, 0.5);
  const map = buildMuscleRecoveryMap(
    [
      {
        date: "2026-11-04",
        endedAt: "2026-11-04T16:00:00.000Z",
        exercises: [
          {
            catalogId: "bench-press",
            muscleGroup: "legs",
            kind: "strength",
            sets: [
              { weightKg: 60, reps: 10, setType: "warmup", completed: true },
              { weightKg: 100, reps: 5, setType: "working", completed: true },
            ],
          },
        ],
      },
    ],
    { weekOf: "2026-11-05", now: NOW },
  );

  const chest = map.rows.find((row) => row.key === "chest");
  const triceps = map.rows.find((row) => row.key === "triceps");
  const shoulders = map.rows.find((row) => row.key === "shoulders");
  const legs = map.rows.find((row) => row.key === "legs");
  assert.equal(chest?.tonnage, 500);
  assert.equal(chest?.status, "loaded");
  assert.equal(chest?.directSets, 1);
  assert.equal(triceps?.tonnage, 125);
  assert.equal(shoulders?.tonnage, 125);
  assert.equal(triceps?.directSets, 0);
  assert.equal(legs, undefined);
});

test("no catalogId falls back to the manual exercise group", () => {
  const map = buildMuscleRecoveryMap(
    [
      {
        date: "2026-11-03",
        endedAt: "2026-11-03T12:00:00.000Z",
        exercises: [
          {
            catalogId: null,
            muscleGroup: "triceps",
            kind: "strength",
            sets: [{ weightKg: 40, reps: 10, setType: "working", completed: true }],
          },
          {
            catalogId: "missing-id",
            muscleGroup: "biceps",
            kind: "strength",
            sets: [{ weightKg: 20, reps: 8, setType: "working", completed: true }],
          },
          {
            catalogId: null,
            muscleGroup: null,
            kind: "strength",
            sets: [{ weightKg: 200, reps: 5, setType: "working", completed: true }],
          },
        ],
      },
    ],
    { weekOf: "2026-11-05", now: NOW },
  );

  const triceps = map.rows.find((row) => row.key === "triceps");
  const biceps = map.rows.find((row) => row.key === "biceps");
  assert.equal(triceps?.tonnage, 400);
  assert.equal(triceps?.directSets, 1);
  assert.equal(biceps?.tonnage, 160);
  assert.equal(map.rows.some((row) => row.tonnage === 1000), false);
});

test("cardio volume is duration; secondary muscles get half", () => {
  const map = buildMuscleRecoveryMap(
    [
      {
        date: "2026-11-05",
        endedAt: "2026-11-05T08:00:00.000Z",
        exercises: [
          {
            catalogId: "walk-incline",
            kind: "cardio",
            sets: [{ durationSec: 1200, distanceKm: 1.5, setType: "working", completed: true }],
          },
        ],
      },
    ],
    { weekOf: "2026-11-05", now: NOW },
  );

  const cardio = map.rows.find((row) => row.key === "cardio");
  const legs = map.rows.find((row) => row.key === "legs");
  assert.equal(cardio?.durationSec, 1200);
  assert.equal(cardio?.tonnage, 0);
  assert.equal(cardio?.status, "loaded");
  assert.equal(legs?.durationSec, 600);
  assert.equal(legs?.directSets, 0);
  assert.equal(legs?.status, "fresh");
});

test("a group outside the recovery window is fresh even with older volume", () => {
  const map = buildMuscleRecoveryMap(
    [
      {
        date: "2026-10-20",
        endedAt: "2026-10-20T12:00:00.000Z",
        exercises: [
          {
            catalogId: "squat",
            kind: "strength",
            sets: [{ weightKg: 100, reps: 5, setType: "working", completed: true }],
          },
        ],
      },
    ],
    { weekOf: "2026-11-05", now: NOW },
  );
  const legs = map.rows.find((row) => row.key === "legs");
  assert.ok(legs);
  assert.equal(legs?.tonnage, 0);
  assert.equal(legs?.status, "fresh");
  assert.equal(map.weekStart, "2026-11-02");
  assert.equal(map.weekEnd, "2026-11-08");
});
