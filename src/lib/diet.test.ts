import assert from "node:assert/strict";
import { test } from "node:test";
import {
  calorieTone,
  compareNutrient,
  formatBalanceLabel,
  formatGoalChoice,
  formatSignedKg,
  recommendDiet,
} from "./diet.ts";

test("recommends a calorie deficit and higher protein for a healthy cut", () => {
  const diet = recommendDiet(80, "LOSE", "HEALTHY");
  assert.equal(diet.calories, 2000);
  assert.equal(diet.protein, 160);
  assert.equal(diet.fat, 64);
  assert.equal(diet.carbs, 196);
});

test("uses a milder cut when losing weight the simple way", () => {
  const simple = recommendDiet(80, "LOSE", "SIMPLE");
  const healthy = recommendDiet(80, "LOSE", "HEALTHY");
  const fast = recommendDiet(80, "LOSE", "FAST");

  assert.equal(simple.calories, 2160);
  assert.equal(simple.protein, 128);
  assert.equal(fast.calories, 1680);
  assert.equal(fast.protein, 176);
  assert.ok(fast.calories < healthy.calories);
  assert.ok(healthy.calories < simple.calories);
});

test("uses a larger surplus when gaining weight faster", () => {
  const simple = recommendDiet(80, "GAIN", "SIMPLE");
  const healthy = recommendDiet(80, "GAIN", "HEALTHY");
  const fast = recommendDiet(80, "GAIN", "FAST");
  const maintain = recommendDiet(80, "MAINTAIN");

  assert.equal(simple.calories, 2640);
  assert.equal(healthy.calories, 2960);
  assert.equal(fast.calories, 3360);
  assert.ok(simple.calories > maintain.calories);
  assert.ok(healthy.calories > simple.calories);
  assert.ok(fast.calories > healthy.calories);
});

test("defaults a missing pace to the healthy plan", () => {
  assert.deepEqual(recommendDiet(80, "LOSE"), recommendDiet(80, "LOSE", "HEALTHY"));
  assert.deepEqual(recommendDiet(80, "GAIN"), recommendDiet(80, "GAIN", "HEALTHY"));
});

test("formats the saved goal with its pace", () => {
  assert.equal(formatGoalChoice("LOSE", "FAST"), "Похудеть · как можно быстрее");
  assert.equal(formatGoalChoice("GAIN", "SIMPLE"), "Набрать вес · как можно проще");
  assert.equal(formatGoalChoice("MAINTAIN", null), "Удержать вес");
});

test("labels intake below target as a deficit", () => {
  const comparison = compareNutrient(1600, 2000);
  assert.equal(comparison.kind, "deficit");
  assert.equal(comparison.remaining, 400);
  assert.equal(formatBalanceLabel(comparison, "ккал"), "дефицит 400 ккал");
  assert.equal(calorieTone(comparison, "LOSE"), "good");
  assert.equal(calorieTone(comparison, "GAIN"), "warn");
});

test("labels intake above target as a surplus", () => {
  const comparison = compareNutrient(2400, 2000);
  assert.equal(comparison.kind, "surplus");
  assert.equal(formatBalanceLabel(comparison, "ккал"), "профицит 400 ккал");
  assert.equal(calorieTone(comparison, "GAIN"), "good");
  assert.equal(calorieTone(comparison, "LOSE"), "warn");
});

test("treats an empty day as neutral rather than a successful deficit", () => {
  const comparison = compareNutrient(0, 2000);
  assert.equal(calorieTone(comparison, "LOSE"), "ok");
});

test("formats weight change from the first measurement", () => {
  assert.equal(formatSignedKg(-3.14), "−3.1 кг");
  assert.equal(formatSignedKg(1.2), "+1.2 кг");
  assert.equal(formatSignedKg(0.04), "0 кг");
});
