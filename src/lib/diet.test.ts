import assert from "node:assert/strict";
import { test } from "node:test";
import {
  calorieTone,
  compareNutrient,
  formatBalanceLabel,
  formatSignedKg,
  recommendDiet,
} from "./diet.ts";

test("recommends a calorie deficit and higher protein for fat loss", () => {
  const diet = recommendDiet(80, "LOSE");
  assert.equal(diet.calories, 2000);
  assert.equal(diet.protein, 160);
  assert.equal(diet.fat, 64);
  assert.equal(diet.carbs, 196);
});

test("recommends more calories for weight gain than maintenance", () => {
  const maintain = recommendDiet(80, "MAINTAIN");
  const gain = recommendDiet(80, "GAIN");
  assert.ok(gain.calories > maintain.calories);
  assert.ok(maintain.calories > recommendDiet(80, "LOSE").calories);
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
