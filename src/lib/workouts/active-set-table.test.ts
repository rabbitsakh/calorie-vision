import assert from "node:assert/strict";
import test from "node:test";
import {
  buildSetTableRows,
  exerciseSetCounts,
  formatBestTarget,
  formatPreviousSetLabel,
  isProgressionUp,
  nextUnfinishedExerciseId,
  pickInitialExpandedId,
  setTableColumns,
  shouldAutoExpandNext,
  toggleExpanded,
} from "./active-set-table.ts";

test("strength table columns are number, last time, kg, reps, check", () => {
  assert.deepEqual(setTableColumns("strength"), ["index", "previous", "kg", "reps", "check"]);
  assert.deepEqual(setTableColumns("cardio"), ["index", "previous", "km", "time", "check"]);
  assert.deepEqual(setTableColumns("bodyweight"), ["index", "previous", "reps", "check"]);
});

test("previous cell is weight×reps aligned to the same set index", () => {
  assert.equal(
    formatPreviousSetLabel({ weightKg: 80, reps: 8 }, "strength"),
    "80×8",
  );
  assert.equal(formatPreviousSetLabel(null, "strength"), "—");
  assert.equal(
    formatPreviousSetLabel({ weightKg: 10, reps: 6 }, "assisted"),
    "−10×6",
  );
});

test("progression arrow when prefilled kg is above last time", () => {
  assert.equal(isProgressionUp("strength", 82.5, 80), true);
  assert.equal(isProgressionUp("strength", 80, 80), false);
  assert.equal(isProgressionUp("assisted", 8, 10), true);
  assert.equal(isProgressionUp("bodyweight", 12, 10), false);
});

test("done/total uses last-time length as the plan", () => {
  const counts = exerciseSetCounts(
    [{ completed: true }, { completed: false }, { completed: false }],
    3,
  );
  assert.equal(counts.label, "1/3");
  assert.equal(exerciseSetCounts([], 0).label, "0/1");
  assert.equal(exerciseSetCounts([{ completed: true }, { completed: true }], 4).label, "2/4");
});

test("best/target shows an arrow only when they differ", () => {
  assert.equal(formatBestTarget(80, 82.5), "80 → 82.5");
  assert.equal(formatBestTarget(80, 80), "80");
  assert.equal(formatBestTarget(null, 60), "цель 60");
  assert.equal(formatBestTarget(null, null), null);
});

test("rows: incomplete planned sets hide the extra draft; autofill draft shows ↑", () => {
  const planned = buildSetTableRows({
    kind: "strength",
    sets: [
      {
        id: "a",
        weightKg: 80,
        reps: 8,
        distanceKm: null,
        durationSec: null,
        setType: "working",
        completed: true,
      },
      {
        id: "b",
        weightKg: 82.5,
        reps: 8,
        distanceKm: null,
        durationSec: null,
        setType: "working",
        completed: false,
      },
    ],
    lastSets: [
      { weightKg: 80, reps: 8 },
      { weightKg: 80, reps: 8 },
    ],
    draft: { kg: "99", reps: "8", km: "", time: "", setType: "working", rpe: "" },
  });
  assert.equal(planned.length, 2);
  assert.equal(planned[1]!.source, "set");
  assert.equal(planned[1]!.previousLabel, "80×8");
  assert.equal(planned[1]!.progressionUp, true);
  assert.equal(planned[1]!.completed, false);

  const open = buildSetTableRows({
    kind: "strength",
    sets: [
      {
        id: "a",
        weightKg: 80,
        reps: 8,
        distanceKm: null,
        durationSec: null,
        setType: "working",
        completed: true,
      },
    ],
    lastSets: [
      { weightKg: 80, reps: 8 },
      { weightKg: 80, reps: 6 },
    ],
    draft: { kg: "82.5", reps: "8", km: "", time: "", setType: "working", rpe: "" },
    extraDrafts: [
      { id: "x", kg: "82.5", reps: "8", km: "", time: "", setType: "working", rpe: "" },
    ],
  });
  assert.deepEqual(
    open.map((r) => r.key),
    ["a", "draft", "extra:x"],
  );
  assert.equal(open[1]!.number, 2);
  assert.equal(open[1]!.previousLabel, "80×6");
  assert.equal(open[1]!.progressionUp, true);
  assert.equal(open[1]!.kg, "82.5");
  assert.equal(open[2]!.extraId, "x");
});

test("empty exercise still has one draft row to log in one tap", () => {
  const rows = buildSetTableRows({
    kind: "strength",
    sets: [],
    lastSets: [{ weightKg: 60, reps: 10 }],
    draft: { kg: "60", reps: "10", km: "", time: "", setType: "working", rpe: "" },
  });
  assert.equal(rows.length, 1);
  assert.equal(rows[0]!.source, "draft");
  assert.equal(rows[0]!.previousLabel, "60×10");
  assert.equal(rows[0]!.completed, false);
});

test("only one exercise is expanded; next unfinished opens after the last set", () => {
  const list = [
    { id: "bench", completed: 3, incomplete: 0, lastSetCount: 3 },
    { id: "row", completed: 0, incomplete: 3, lastSetCount: 3 },
    { id: "curl", completed: 0, incomplete: 0, lastSetCount: 0 },
  ];
  assert.equal(pickInitialExpandedId(list), "row");
  assert.equal(toggleExpanded("row", "bench"), "bench");
  assert.equal(toggleExpanded("bench", "bench"), null);
  assert.equal(nextUnfinishedExerciseId(list, "bench"), "row");
  assert.equal(
    shouldAutoExpandNext({
      loggedNumber: 3,
      lastSetCount: 3,
      incompleteRemaining: 0,
      extraDraftsRemaining: 0,
    }),
    true,
  );
  assert.equal(
    shouldAutoExpandNext({
      loggedNumber: 2,
      lastSetCount: 3,
      incompleteRemaining: 1,
      extraDraftsRemaining: 0,
    }),
    false,
  );
  assert.equal(
    shouldAutoExpandNext({
      loggedNumber: 3,
      lastSetCount: 3,
      incompleteRemaining: 0,
      extraDraftsRemaining: 1,
    }),
    false,
  );
  assert.equal(
    shouldAutoExpandNext({
      loggedNumber: 1,
      lastSetCount: 0,
      incompleteRemaining: 0,
      extraDraftsRemaining: 0,
    }),
    false,
  );
  assert.equal(nextUnfinishedExerciseId(
    [{ id: "bench", completed: 3, incomplete: 0, lastSetCount: 3 }],
    "bench",
  ), null);
});
