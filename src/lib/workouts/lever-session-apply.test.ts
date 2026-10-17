import assert from "node:assert/strict";
import { test } from "node:test";
import {
  countWorkingSets,
  formatArmedRecoveryChromeLine,
  formatLeverRecoveryHint,
  formatRecoveryOutcomeLine,
  mergeDraftWithLeverGoal,
  needsVolumeExtraSet,
  persistLeverRecoveryMemory,
  resolveLeverSessionGoal,
  volumeExtraSetBody,
  type LeverSessionGoal,
} from "./lever-session-apply.ts";
import {
  LEVER_OUTCOME_HISTORY_KEY,
  recordLeverOutcome,
  resetLeverOutcomeHistoryForTests,
} from "./lever-outcome-history.ts";
import {
  clearLeverRecoveryFlag,
  getLeverMemory,
  listArmedRecoveries,
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
  map.delete(LEVER_OUTCOME_HISTORY_KEY);
  resetLeverOutcomeHistoryForTests();
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

test("L: 2× miss on weight → soft deload kg", () => {
  installStorage();
  setLeverMemory({
    name: "Присед",
    lever: "weight",
    basisKg: 100,
    targetKg: 105,
    targetReps: 5,
    at: "2026-10-10",
  });
  recordLeverOutcome({ name: "Присед", lever: "weight", outcome: "miss", at: "2026-10-12" });
  recordLeverOutcome({ name: "Присед", lever: "weight", outcome: "miss", at: "2026-10-13" });
  const g = resolveLeverSessionGoal({
    name: "Присед",
    kind: "barbell",
    progressRate: 0.05,
    sets: [],
    lastTimeSets: [{ weightKg: 100, reps: 5, setType: "working", completed: true }],
  });
  assert.equal(g?.recovery, "deload");
  assert.equal(g?.lever, "weight");
  assert.equal(g?.kg, 90);
  assert.equal(formatLeverRecoveryHint(g), "Soft deload после 2× мимо");
  persistLeverRecoveryMemory("Присед", g!, 100);
  assert.equal(getLeverMemory("Присед")?.targetKg, 90);
  assert.equal(getLeverMemory("Присед")?.recovery, "deload");
});

test("L: 2× miss on volume → switch to reps", () => {
  installStorage();
  setLeverMemory({
    name: "Тяга",
    lever: "volume",
    basisKg: 80,
    targetKg: 80,
    targetReps: 8,
    at: "2026-10-10",
  });
  recordLeverOutcome({ name: "Тяга", lever: "volume", outcome: "miss", at: "2026-10-12" });
  recordLeverOutcome({ name: "Тяга", lever: "volume", outcome: "miss", at: "2026-10-13" });
  const g = resolveLeverSessionGoal({
    name: "Тяга",
    kind: "barbell",
    progressRate: 0.05,
    sets: [{ weightKg: 80, reps: 8, setType: "working", completed: false }],
    lastTimeSets: [{ weightKg: 80, reps: 8, setType: "working", completed: true }],
  });
  assert.equal(g?.recovery, "switch");
  assert.equal(g?.lever, "reps");
  assert.equal(g?.extraSet, false);
  assert.equal(g?.kg, 80);
  assert.equal(formatLeverRecoveryHint(g), "Рычаг сменён после 2× мимо");
});

test("N: armed deload recovery does not stack — switches lever", () => {
  installStorage();
  setLeverMemory({
    name: "Присед",
    lever: "weight",
    basisKg: 100,
    targetKg: 90,
    targetReps: 5,
    at: "2026-10-14",
    recovery: "deload",
  });
  recordLeverOutcome({ name: "Присед", lever: "weight", outcome: "miss", at: "2026-10-12" });
  recordLeverOutcome({ name: "Присед", lever: "weight", outcome: "miss", at: "2026-10-13" });
  const g = resolveLeverSessionGoal({
    name: "Присед",
    kind: "barbell",
    progressRate: 0.05,
    sets: [],
    lastTimeSets: [{ weightKg: 100, reps: 5, setType: "working", completed: true }],
  });
  assert.equal(g?.recovery, "switch");
  assert.equal(g?.lever, "reps");
  assert.equal(g?.kg, 100);
});

test("N: formatRecoveryOutcomeLine hit/miss", () => {
  assert.equal(
    formatRecoveryOutcomeLine("deload", "hit"),
    "Восстановление сработало — цель взята",
  );
  assert.match(formatRecoveryOutcomeLine("deload", "miss") ?? "", /soft deload/i);
  assert.equal(formatRecoveryOutcomeLine("switch", "partial"), null);
  assert.equal(formatRecoveryOutcomeLine(null, "hit"), null);
});

test("N: clearLeverRecoveryFlag keeps lever targets", () => {
  installStorage();
  setLeverMemory({
    name: "Жим",
    lever: "weight",
    basisKg: 80,
    targetKg: 72,
    targetReps: 5,
    at: "2026-10-14",
    recovery: "deload",
  });
  assert.equal(getLeverMemory("Жим")?.recovery, "deload");
  clearLeverRecoveryFlag("Жим");
  const mem = getLeverMemory("Жим");
  assert.equal(mem?.recovery, undefined);
  assert.equal(mem?.lever, "weight");
  assert.equal(mem?.targetKg, 72);
});

test("O: listArmedRecoveries + Today chrome line", () => {
  installStorage();
  assert.equal(listArmedRecoveries().length, 0);
  setLeverMemory({
    name: "Присед",
    lever: "weight",
    basisKg: 100,
    targetKg: 90,
    at: "2026-10-16",
    recovery: "deload",
  });
  setLeverMemory({
    name: "Тяга",
    lever: "reps",
    basisKg: 80,
    at: "2026-10-15",
    recovery: "switch",
  });
  const armed = listArmedRecoveries(3);
  assert.equal(armed.length, 2);
  assert.match(formatArmedRecoveryChromeLine(armed[0]!) ?? "", /soft deload|новый рычаг/);
  assert.match(formatArmedRecoveryChromeLine({ name: "Тяга", recovery: "switch" }) ?? "", /новый рычаг/);
});
