import assert from "node:assert/strict";
import { test } from "node:test";
import {
  compareSetToLeverGoal,
  evaluateSessionLeverOutcome,
  formatLeverSetToast,
  leverGoalFromMemory,
} from "./lever-set-feedback.ts";

test("weight lever: hit / close / miss", () => {
  const goal = { lever: "weight" as const, kg: 80, reps: null };
  assert.equal(
    compareSetToLeverGoal({ weightKg: 80, reps: 5, setType: "working", completed: true }, goal),
    "hit",
  );
  assert.equal(
    compareSetToLeverGoal({ weightKg: 77, reps: 5, setType: "working", completed: true }, goal),
    "close",
  );
  assert.equal(
    compareSetToLeverGoal({ weightKg: 70, reps: 5, setType: "working", completed: true }, goal),
    "miss",
  );
  assert.equal(
    compareSetToLeverGoal({ weightKg: 80, reps: 5, setType: "warmup", completed: true }, goal),
    null,
  );
});

test("reps lever: needs reps at roughly target kg", () => {
  const goal = { lever: "reps" as const, kg: 70, reps: 8 };
  assert.equal(
    compareSetToLeverGoal({ weightKg: 70, reps: 8, setType: "working", completed: true }, goal),
    "hit",
  );
  assert.equal(
    compareSetToLeverGoal({ weightKg: 70, reps: 7, setType: "working", completed: true }, goal),
    "close",
  );
  assert.equal(
    compareSetToLeverGoal({ weightKg: 70, reps: 4, setType: "working", completed: true }, goal),
    "miss",
  );
});

test("volume lever session hit when +1 working set", () => {
  const goal = { lever: "volume" as const, kg: 60, reps: 8, extraSet: true };
  const sets = [
    { weightKg: 60, reps: 8, setType: "working", completed: true },
    { weightKg: 60, reps: 8, setType: "working", completed: true },
    { weightKg: 60, reps: 8, setType: "working", completed: true },
  ];
  assert.equal(evaluateSessionLeverOutcome(sets, goal, 2), "hit");
  assert.equal(evaluateSessionLeverOutcome(sets.slice(0, 2), goal, 2), "partial");
});

test("formatLeverSetToast mentions target", () => {
  const msg = formatLeverSetToast(
    "hit",
    { lever: "weight", kg: 84, reps: null },
    "Жим",
  );
  assert.match(msg, /Цель взята/);
  assert.match(msg, /84/);
  assert.match(msg, /Жим/);
});

test("leverGoalFromMemory maps entry", () => {
  assert.equal(leverGoalFromMemory(null), null);
  const g = leverGoalFromMemory({
    lever: "reps",
    targetKg: 70,
    targetReps: 9,
  });
  assert.equal(g?.lever, "reps");
  assert.equal(g?.reps, 9);
});
