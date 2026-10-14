import assert from "node:assert/strict";
import { test } from "node:test";
import {
  countWorkingSets,
  mergeDraftWithLeverGoal,
  needsVolumeExtraSet,
  resolveLeverSessionGoal,
  volumeExtraSetBody,
  type LeverSessionGoal,
} from "./lever-session-apply.ts";
import {
  PROGRESSION_LEVER_MEMORY_KEY,
  setLeverMemory,
} from "./progression-lever-memory.ts";

function installStorage() {
  const map = new Map<string, string>();
  Object.defineProperty(globalThis, "localStorage", {
    value: {
      getItem: (k: string) => map.get(k) ?? null,
      setItem: (k: string, v: string) => {
        map.set(k, v);
      },
      removeItem: (k: string) => {
        map.delete(k);
      },
      clear: () => map.clear(),
      key: () => null,
      get length() {
        return map.size;
      },
    },
    configurable: true,
  });
  map.delete(PROGRESSION_LEVER_MEMORY_KEY);
}

test("countWorkingSets skips warmup/drop", () => {
  assert.equal(
    countWorkingSets([
      { weightKg: 40, reps: 8, setType: "warmup", completed: true },
      { weightKg: 80, reps: 5, setType: "working", completed: true },
      { weightKg: 60, reps: 8, setType: "drop", completed: true },
      { weightKg: 80, reps: 5, setType: "working", completed: false },
    ]),
    2,
  );
});

test("resolveLeverSessionGoal null without memory", () => {
  installStorage();
  assert.equal(
    resolveLeverSessionGoal({
      name: "Жим",
      kind: "barbell",
      progressRate: 0.05,
      sets: [],
      lastTimeSets: [{ weightKg: 80, reps: 5, setType: "working" }],
    }),
    null,
  );
});

test("resolveLeverSessionGoal reps from memory + advice", () => {
  installStorage();
  setLeverMemory({
    name: "Жим",
    lever: "reps",
    basisKg: 80,
    targetKg: 80,
    targetReps: 6,
    at: "2026-10-14",
  });
  const g = resolveLeverSessionGoal({
    name: "Жим",
    kind: "barbell",
    progressRate: 0.05,
    sets: [],
    lastTimeSets: [{ weightKg: 80, reps: 5, setType: "working", completed: true }],
    historyPoints: [
      { date: "a", topWeightKg: 77.5, topReps: 5, totalLoad: 400 },
      { date: "b", topWeightKg: 80, topReps: 5, totalLoad: 400 },
    ],
  });
  assert.equal(g?.lever, "reps");
  assert.equal(g?.fromMemory, true);
  assert.equal(g?.kg, 80);
  assert.equal(g?.reps, 6);
  assert.equal(g?.extraSet, false);
});

test("resolveLeverSessionGoal volume marks extraSet", () => {
  installStorage();
  setLeverMemory({
    name: "Присед",
    lever: "volume",
    basisKg: 100,
    targetKg: 100,
    targetReps: 5,
    at: "2026-10-14",
  });
  const g = resolveLeverSessionGoal({
    name: "Присед",
    kind: "barbell",
    progressRate: 0.05,
    sets: [
      { weightKg: 100, reps: 5, setType: "working", completed: false },
      { weightKg: 100, reps: 5, setType: "working", completed: false },
      { weightKg: 100, reps: 5, setType: "working", completed: false },
    ],
    lastTimeSets: [
      { weightKg: 100, reps: 5, setType: "working", completed: true },
      { weightKg: 100, reps: 5, setType: "working", completed: true },
      { weightKg: 100, reps: 5, setType: "working", completed: true },
    ],
  });
  assert.equal(g?.extraSet, true);
  assert.equal(g?.kg, 100);
});

test("needsVolumeExtraSet for planned = last count", () => {
  const goal: LeverSessionGoal = {
    lever: "volume",
    fromMemory: true,
    kg: 80,
    reps: 5,
    extraSet: true,
  };
  const sets = [
    { weightKg: 80, reps: 5, setType: "working", completed: false },
    { weightKg: 80, reps: 5, setType: "working", completed: false },
    { weightKg: 80, reps: 5, setType: "working", completed: false },
  ];
  assert.equal(needsVolumeExtraSet(sets, 3, goal), true);
  assert.equal(
    needsVolumeExtraSet(
      [...sets, { weightKg: 80, reps: 5, setType: "working", completed: false }],
      3,
      goal,
    ),
    false,
  );
  assert.equal(needsVolumeExtraSet([], 3, goal), false);
});

test("mergeDraftWithLeverGoal overlays kg and reps", () => {
  const m = mergeDraftWithLeverGoal(
    { kg: "70", reps: "8" },
    {
      lever: "weight",
      fromMemory: true,
      kg: 84,
      reps: 5,
      extraSet: false,
    },
  );
  assert.equal(m.kg, "84");
  assert.equal(m.reps, "5");
});

test("volumeExtraSetBody requires kg and reps", () => {
  assert.deepEqual(
    volumeExtraSetBody({
      lever: "volume",
      fromMemory: true,
      kg: 80,
      reps: 5,
      extraSet: true,
    }),
    { weightKg: 80, reps: 5, setType: "working", completed: false },
  );
  assert.equal(
    volumeExtraSetBody({
      lever: "volume",
      fromMemory: true,
      kg: 80,
      reps: null,
      extraSet: true,
    }),
    null,
  );
});
