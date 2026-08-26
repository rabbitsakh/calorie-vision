import assert from "node:assert/strict";
import { test } from "node:test";
import {
  buildGoalAwareCalorieTip,
  calorieTone,
  compareNutrient,
  dailyGoalCelebrationCopy,
  formatBalanceLabel,
  formatCalorieVsTargetLabel,
  formatGoalChoice,
  formatSignedKg,
  isCalorieGoalCorridor,
  isDangerousCalorieUndereat,
  recommendDiet,
  applyFiberSugarOverrides,
  explainDiet,
} from "./diet.ts";

test("recommends a calorie deficit and higher protein for a healthy cut", () => {
  const diet = recommendDiet(80, "LOSE", "HEALTHY", "FEMALE");
  assert.equal(diet.calories, 1495);
  assert.equal(diet.protein, 136);
  assert.equal(diet.fat, 60);
  assert.equal(diet.carbs, 102.8);
});

test("applies optional fiber and sugar target overrides", () => {
  const base = recommendDiet(80, "MAINTAIN", null, "FEMALE");
  const overridden = applyFiberSugarOverrides(base, { fiberTargetG: 35, sugarTargetG: 40 });
  assert.equal(overridden.fiber, 35);
  assert.equal(overridden.sugar, 40);
  assert.equal(overridden.calories, base.calories);
  const untouched = applyFiberSugarOverrides(base, { fiberTargetG: null, sugarTargetG: null });
  assert.equal(untouched.fiber, base.fiber);
  assert.equal(untouched.sugar, base.sugar);
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

test("does not set 1.9 g protein per kg of a very high body weight", () => {
  const diet = recommendDiet(138.9, "LOSE", "FAST", "MALE");
  assert.equal(diet.calories, 2082);
  assert.equal(diet.protein, 174.6);
  assert.equal(diet.fat, 64.3);
  assert.equal(diet.carbs, 201.2);
  assert.ok(diet.protein < 138.9 * 1.9);
  assert.ok(diet.protein * 4 + diet.fat * 9 < diet.calories * 0.7);
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

test("LOSE under target is not framed as eat more", () => {
  const tip = buildGoalAwareCalorieTip({
    actual: 1600,
    target: 2000,
    goal: "LOSE",
    tense: "yesterday",
  });
  assert.match(tip, /ниже цели|нормально|похудения/i);
  assert.doesNotMatch(tip, /не хватило|перекус/i);

  const label = formatCalorieVsTargetLabel(1600, 2000, "LOSE");
  assert.equal(label, " (ниже цели на 400 ккал)");
});

test("LOSE very low intake warns about cutting too hard", () => {
  const tip = buildGoalAwareCalorieTip({
    actual: 1200,
    target: 2000,
    goal: "LOSE",
  });
  assert.match(tip, /жёстко|не урезать/i);
});

test("GAIN under target still suggests eating more", () => {
  const tip = buildGoalAwareCalorieTip({
    actual: 1600,
    target: 2000,
    goal: "GAIN",
  });
  assert.match(tip, /не хватило|добавьте/i);
});

test("calorie goal corridor is ±8% of target", () => {
  assert.equal(isCalorieGoalCorridor(2000, 2000), true);
  assert.equal(isCalorieGoalCorridor(1850, 2000), true); // 7.5%
  assert.equal(isCalorieGoalCorridor(1839, 2000), false); // >8%
  assert.equal(isCalorieGoalCorridor(0, 2000), false);
});

test("dangerous LOSE undereat is below 75% of target", () => {
  assert.equal(isDangerousCalorieUndereat(1400, 2000, "LOSE"), true);
  assert.equal(isDangerousCalorieUndereat(1600, 2000, "LOSE"), false);
  assert.equal(isDangerousCalorieUndereat(1400, 2000, "GAIN"), false);
});

test("daily goal celebration copy matches goal", () => {
  assert.match(dailyGoalCelebrationCopy("LOSE").subtitle, /дефиците/i);
  assert.match(dailyGoalCelebrationCopy("GAIN").subtitle, /набор/i);
  assert.match(dailyGoalCelebrationCopy("MAINTAIN").subtitle, /коридоре нормы/i);
  assert.match(dailyGoalCelebrationCopy("LOSE", 1840, 2000).subtitle, /1840 \/ 2000/);
});

test("activity level changes TDEE while LIGHT matches legacy calories", () => {
  const light = recommendDiet(80, "MAINTAIN", null, "FEMALE", null, null, "LIGHT");
  const sedentary = recommendDiet(80, "MAINTAIN", null, "FEMALE", null, null, "SEDENTARY");
  const moderate = recommendDiet(80, "MAINTAIN", null, "FEMALE", null, null, "MODERATE");
  assert.equal(light.calories, 1869);
  assert.ok(sedentary.calories < light.calories);
  assert.ok(moderate.calories > light.calories);
});

test("explainDiet returns BMR × activity breakdown", () => {
  const { explanation, bmr, maintainCalories, activityFactor } = explainDiet(
    80,
    "MAINTAIN",
    null,
    "FEMALE",
    null,
    null,
    "LIGHT",
  );
  assert.equal(activityFactor, 1.25);
  assert.ok(bmr > 0);
  assert.equal(maintainCalories, Math.round(bmr * 1.25));
  assert.match(explanation, /BMR/);
  assert.match(explanation, /поддержание/);
});

test("maintain corridor is wider than lose/gain (±10%)", () => {
  assert.equal(isCalorieGoalCorridor(2000, 2000, "MAINTAIN"), true);
  assert.equal(isCalorieGoalCorridor(1830, 2000, "MAINTAIN"), true); // 8.5% — outside ±8%
  assert.equal(isCalorieGoalCorridor(1830, 2000, "LOSE"), false);
  assert.equal(isCalorieGoalCorridor(1800, 2000, "MAINTAIN"), true); // exactly 10%
});
