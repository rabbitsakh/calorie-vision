import assert from "node:assert/strict";
import { test } from "node:test";
import { canonicalizeMuscleKey } from "./muscle-groups.ts";
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

test("fine muscle names roll up into every map group", () => {
  const cases: Array<[string, string]> = [
    ["quadriceps", "legs"],
    ["hamstrings", "legs"],
    ["glutes", "legs"],
    ["calves", "legs"],
    ["бицепс бедра", "legs"],
    ["ягодицы", "legs"],
    ["дельты", "shoulders"],
    ["rear-delt", "shoulders"],
    ["передняя дельта", "shoulders"],
    ["задняя дельта", "shoulders"],
    ["lats", "back"],
    ["трапеции", "back"],
    ["pecs", "chest"],
    ["грудь", "chest"],
    ["бицепс", "biceps"],
    ["трицепс", "triceps"],
    ["пресс", "abs"],
    ["кардио", "cardio"],
  ];
  for (const [raw, group] of cases) {
    assert.equal(canonicalizeMuscleKey(raw), group, raw);
  }
});

test("direct shoulder press, smith, raises and rear delt stay direct beside bench", () => {
  const set = (weightKg: number, reps: number) => [
    { weightKg, reps, setType: "working" as const, completed: true },
  ];
  const map = buildMuscleRecoveryMap(
    [
      {
        date: "2026-11-04",
        startedAt: "2026-10-28T08:00:00.000Z",
        exercises: [
          { catalogId: "ohp", kind: "strength", sets: set(40, 8) },
          { catalogId: "smith-ohp", kind: "strength", sets: set(30, 10) },
          { catalogId: "lateral", kind: "strength", sets: set(10, 12) },
          { catalogId: "rear-delt", kind: "strength", sets: set(8, 15) },
        ],
      },
      {
        date: "2026-11-05",
        exercises: [{ catalogId: "bench-press", kind: "strength", sets: set(100, 5) }],
      },
    ],
    { weekOf: "2026-11-05", now: NOW },
  );
  const shoulders = map.rows.find((row) => row.key === "shoulders");
  assert.ok(shoulders);
  assert.equal(shoulders?.directTonnage, 40 * 8 + 30 * 10 + 10 * 12 + 8 * 15);
  assert.equal(shoulders?.indirectTonnage, 125);
  assert.equal(shoulders?.directSets, 4);
  assert.equal(shoulders?.lastDirectDate, "2026-11-04");
  assert.ok((shoulders?.hoursSinceStrong ?? 99) < 48);
  assert.equal(shoulders?.status, "loaded");
});

test("squat, curl, glutes and calves are direct legs; cardio minutes do not replace them", () => {
  const map = buildMuscleRecoveryMap(
    [
      {
        date: "2026-11-04",
        exercises: [
          {
            catalogId: "squat",
            kind: "strength",
            sets: [{ weightKg: 100, reps: 5, setType: "working", completed: true }],
          },
          {
            catalogId: "leg-curl",
            kind: "strength",
            sets: [{ weightKg: 40, reps: 10, setType: "working", completed: true }],
          },
          {
            catalogId: "hip-thrust",
            kind: "strength",
            sets: [{ weightKg: 80, reps: 8, setType: "working", completed: true }],
          },
          {
            catalogId: "calf-stand",
            kind: "strength",
            sets: [{ weightKg: 50, reps: 12, setType: "working", completed: true }],
          },
          {
            muscleGroup: null,
            primaryMuscles: ["quadriceps", "hamstrings"],
            secondaryMuscles: ["glutes", "calves"],
            kind: "strength",
            sets: [{ weightKg: 20, reps: 10, setType: "working", completed: true }],
          },
        ],
      },
      {
        date: "2026-11-05",
        exercises: [
          {
            catalogId: "walk-incline",
            kind: "cardio",
            sets: [{ durationSec: 1800, distanceKm: 2, setType: "working", completed: true }],
          },
        ],
      },
    ],
    { weekOf: "2026-11-05", now: NOW },
  );
  const legs = map.rows.find((row) => row.key === "legs");
  assert.ok(legs);
  assert.equal(legs?.directTonnage, 100 * 5 + 40 * 10 + 80 * 8 + 50 * 12 + 200);
  assert.equal(legs?.indirectDurationSec, 900);
  assert.equal(legs?.directDurationSec, 0);
  assert.equal(legs?.lastDirectDate, "2026-11-04");
  assert.notEqual(legs?.status, "fresh");
});

test("deadlift loads the back directly and the legs only as assistance", () => {
  const map = buildMuscleRecoveryMap(
    [
      {
        date: "2026-11-05",
        exercises: [
          {
            catalogId: "deadlift",
            kind: "strength",
            sets: [{ weightKg: 140, reps: 5, setType: "working", completed: true }],
          },
        ],
      },
    ],
    { weekOf: "2026-11-05", now: NOW },
  );
  const back = map.rows.find((row) => row.key === "back");
  const legs = map.rows.find((row) => row.key === "legs");
  assert.equal(back?.directTonnage, 700);
  assert.equal(back?.lastDirectDate, "2026-11-05");
  assert.equal(legs?.directTonnage, 0);
  assert.equal(legs?.indirectTonnage, 350);
  assert.equal(legs?.lastDirectDate, null);
});

test("unlinked exercise uses the session muscle tag, and a stale clock does not move the day", () => {
  const map = buildMuscleRecoveryMap(
    [
      {
        date: "2026-11-05",
        startedAt: "2026-10-24T08:00:00.000Z",
        sessionGroups: ["Плечи"],
        exercises: [
          {
            catalogId: null,
            muscleGroup: null,
            kind: "strength",
            sets: [{ weightKg: 25, reps: 10, setType: "working", completed: true }],
          },
        ],
      },
    ],
    { weekOf: "2026-11-05", now: NOW },
  );
  const shoulders = map.rows.find((row) => row.key === "shoulders");
  assert.equal(shoulders?.directTonnage, 250);
  assert.equal(shoulders?.indirectTonnage, 0);
  assert.equal(shoulders?.lastDirectDate, "2026-11-05");
  assert.ok((shoulders?.hoursSinceStrong ?? 99) < 24);
});
