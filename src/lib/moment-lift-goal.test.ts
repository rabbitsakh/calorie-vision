import assert from "node:assert/strict";
import { test } from "node:test";
import {
  formatMorningLiftGoalHint,
  pickMorningLiftExercise,
  shortExerciseLabel,
} from "./moment-lift-goal.ts";

test("pickMorningLiftExercise prefers bench-like strength", () => {
  const pick = pickMorningLiftExercise([
    { name: "Кардио", kind: "cardio" },
    { name: "Разгибания", kind: "machine" },
    { name: "Жим лёжа", kind: "barbell" },
  ]);
  assert.equal(pick?.name, "Жим лёжа");
});

test("shortExerciseLabel trims long names", () => {
  assert.equal(shortExerciseLabel("Жим лёжа"), "Жим лёжа");
  assert.equal(shortExerciseLabel("Приседания со штангой на спине, пауза"), "Приседания со шт…");
});

test("formatMorningLiftGoalHint with last session shows +delta", () => {
  const hint = formatMorningLiftGoalHint({
    exerciseName: "Жим лёжа",
    lastKg: 80,
    progressRate: 0.05,
  });
  assert.equal(hint, "Жим лёжа · 84 кг (+4)");
});

test("formatMorningLiftGoalHint falls back to planned", () => {
  assert.equal(
    formatMorningLiftGoalHint({ exerciseName: "Жим", lastKg: null, plannedKg: 60 }),
    "Жим · 60 кг",
  );
  assert.equal(formatMorningLiftGoalHint({ exerciseName: "Жим", lastKg: null }), null);
});
