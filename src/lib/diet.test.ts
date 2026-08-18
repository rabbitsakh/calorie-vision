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
  const diet = recommendDiet(80, "LOSE", "HEALTHY", "FEMALE");
  assert.equal(diet.calories, 1495);
  assert.equal(diet.protein, 136);
  assert.equal(diet.fat, 60);
  assert.equal(diet.carbs, 102.8);
});

test("uses a milder cut when losing weight the simple way", () => {
  const simple = recommendDiet(80, "LOSE", "SIMPLE", "FEMALE");
  const healthy = recommendDiet(80, "LOSE", "HEALTHY", "FEMALE");
  const fast = recommendDiet(80, "LOSE", "FAST", "FEMALE");

  assert.equal(simple.calories, 1682);
  assert.equal(fast.calories, 1346);
  assert.ok(fast.calories < healthy.calories);
  assert.ok(healthy.calories < simple.calories);
});

test("uses a larger surplus when gaining weight faster", () => {
  const simple = recommendDiet(80, "GAIN", "SIMPLE", "FEMALE");
  const healthy = recommendDiet(80, "GAIN", "HEALTHY", "FEMALE");
  const fast = recommendDiet(80, "GAIN", "FAST", "FEMALE");
  const maintain = recommendDiet(80, "MAINTAIN", null, "FEMALE");

  assert.equal(maintain.calories, 1869);
  assert.ok(simple.calories > maintain.calories);
  assert.ok(healthy.calories > simple.calories);
  assert.ok(fast.calories > healthy.calories);
});

test("gives men a higher maintenance target than women at the same weight", () => {
  const woman = recommendDiet(80, "MAINTAIN", null, "FEMALE");
  const man = recommendDiet(80, "MAINTAIN", null, "MALE");
  assert.equal(woman.calories, 1869);
  assert.equal(man.calories, 2155);
  assert.ok(man.calories > woman.calories);
});

test("does not inflate calories linearly for a high body weight", () => {
  const oldRuleOfThumb = 140 * 30;
  const woman = recommendDiet(140, "MAINTAIN", null, "FEMALE");
  const man = recommendDiet(140, "MAINTAIN", null, "MALE");
  assert.equal(woman.calories, 2619);
  assert.equal(man.calories, 2905);
  assert.ok(woman.calories < oldRuleOfThumb);
  assert.ok(man.calories < oldRuleOfThumb);
});

test("defaults a missing pace to the healthy plan", () => {
  assert.deepEqual(
    recommendDiet(80, "LOSE", undefined, "FEMALE"),
    recommendDiet(80, "LOSE", "HEALTHY", "FEMALE"),
  );
  assert.deepEqual(
    recommendDiet(80, "GAIN", undefined, "FEMALE"),
    recommendDiet(80, "GAIN", "HEALTHY", "FEMALE"),
  );
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
