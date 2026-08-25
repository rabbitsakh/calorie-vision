import assert from "node:assert/strict";
import { test } from "node:test";
import {
  defaultLabelForCalories,
  EXERCISE_QUICK_CHIPS,
  normalizeCaloriesBurned,
  normalizeExerciseLabel,
} from "./exercise.ts";

test("quick chips map calories to default Russian labels", () => {
  assert.equal(EXERCISE_QUICK_CHIPS.length, 4);
  assert.equal(defaultLabelForCalories(150), "Ходьба");
  assert.equal(defaultLabelForCalories(250), "Зал");
  assert.equal(defaultLabelForCalories(400), "Бег");
  assert.equal(defaultLabelForCalories(600), "Интервалы");
  assert.equal(defaultLabelForCalories(999), "Тренировка");
});

test("normalizeExerciseLabel trims and enforces 1–80 chars", () => {
  assert.equal(normalizeExerciseLabel("  Бег  "), "Бег");
  assert.equal(normalizeExerciseLabel(""), null);
  assert.equal(normalizeExerciseLabel("   "), null);
  assert.equal(normalizeExerciseLabel("x".repeat(81)), null);
  assert.equal(normalizeExerciseLabel("x".repeat(80)), "x".repeat(80));
  assert.equal(normalizeExerciseLabel(null), null);
});

test("normalizeCaloriesBurned enforces 1–5000", () => {
  assert.equal(normalizeCaloriesBurned(250), 250);
  assert.equal(normalizeCaloriesBurned(250.6), 251);
  assert.equal(normalizeCaloriesBurned(0), null);
  assert.equal(normalizeCaloriesBurned(5001), null);
  assert.equal(normalizeCaloriesBurned("400"), 400);
  assert.equal(normalizeCaloriesBurned("abc"), null);
});
