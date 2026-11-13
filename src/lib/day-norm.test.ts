import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { resolveDayNorm, resolvePlanNorm } from "./day-norm.ts";
import { macroWeightKg, recommendDietForProfile } from "./diet.ts";

const YEAR = 2026;

function macrosSum(target: { protein: number; fat: number; carbs: number }): number {
  return target.protein * 4 + target.fat * 9 + target.carbs * 4;
}

test("мужчина 35 лет 85 кг 180 см похудение, день без зала", () => {
  const norm = resolveDayNorm({
    weightKg: 85,
    goal: "LOSE",
    pace: "HEALTHY",
    sex: "MALE",
    heightCm: 180,
    birthYear: YEAR - 35,
    activity: "LIGHT",
  });
  assert.equal(norm.bmr, 1805);
  assert.equal(norm.maintainCalories, 2482);
  assert.equal(norm.target.calories, 2110);
  assert.equal(norm.target.protein, 136);
  assert.equal(norm.target.fat, 68);
  assert.equal(norm.target.carbs, 238.5);
  assert.equal(norm.target.fiber, 30);
  assert.equal(norm.target.waterMl, 3036);
  assert.equal(macrosSum(norm.target), 2110);
});

test("тот же мужчина в день зала: расход прибавляется, БЖУ сходятся", () => {
  const norm = resolveDayNorm({
    weightKg: 85,
    goal: "LOSE",
    pace: "HEALTHY",
    sex: "MALE",
    heightCm: 180,
    birthYear: YEAR - 35,
    activity: "LIGHT",
    burnKcal: 439,
    trainingDay: true,
  });
  assert.equal(norm.target.calories, 2330);
  assert.equal(norm.training?.baseCalories, 2110);
  assert.equal(norm.training?.calorieBonusKcal, 220);
  assert.equal(norm.target.protein, 153);
  assert.equal(norm.target.fat, 68);
  assert.equal(norm.target.carbs, 276.5);
  assert.equal(norm.target.fiber, 33);
  assert.equal(norm.target.waterMl, 3536);
  assert.ok(Math.abs(macrosSum(norm.target) - norm.target.calories) <= norm.target.calories * 0.02);
});

test("женщина 28 лет 60 кг 165 см удержание", () => {
  const norm = resolveDayNorm({
    weightKg: 60,
    goal: "MAINTAIN",
    sex: "FEMALE",
    heightCm: 165,
    birthYear: YEAR - 28,
    activity: "LIGHT",
  });
  assert.equal(norm.bmr, 1330);
  assert.equal(norm.maintainCalories, 1829);
  assert.equal(norm.target.calories, 1829);
  assert.equal(norm.target.protein, 84);
  assert.equal(norm.target.fat, 50.8);
  assert.equal(norm.target.carbs, 259);
  assert.equal(norm.target.fiber, 26);
  assert.equal(norm.target.waterMl, 2000);
  assert.ok(Math.abs(macrosSum(norm.target) - norm.target.calories) <= norm.target.calories * 0.02);
});

test("мужчина 25 лет 70 кг 178 см набор, отдых и час зала", () => {
  const rest = resolveDayNorm({
    weightKg: 70,
    goal: "GAIN",
    pace: "HEALTHY",
    sex: "MALE",
    heightCm: 178,
    birthYear: YEAR - 25,
    activity: "LIGHT",
  });
  assert.equal(rest.bmr, 1693);
  assert.equal(rest.maintainCalories, 2327);
  assert.equal(rest.target.calories, 2560);
  assert.equal(rest.target.protein, 112);
  assert.equal(rest.target.fat, 71.1);
  assert.equal(rest.target.carbs, 368);
  assert.equal(rest.target.fiber, 36);
  assert.equal(rest.target.waterMl, 2500);

  const gym = resolveDayNorm({
    weightKg: 70,
    goal: "GAIN",
    pace: "HEALTHY",
    sex: "MALE",
    heightCm: 178,
    birthYear: YEAR - 25,
    activity: "LIGHT",
    burnKcal: 350,
    trainingDay: true,
  });
  assert.equal(gym.target.calories, 2910);
  assert.equal(gym.target.protein, 126);
  assert.equal(gym.target.fat, 80.8);
  assert.equal(gym.target.carbs, 419.7);
  assert.equal(gym.target.fiber, 41);
  assert.equal(gym.target.waterMl, 3000);
  assert.equal(macrosSum(gym.target), 2910);
});

test("быстрое похудение не опускается ниже BMR", () => {
  const norm = resolveDayNorm({
    weightKg: 85,
    goal: "LOSE",
    pace: "FAST",
    sex: "MALE",
    heightCm: 180,
    birthYear: YEAR - 35,
    activity: "SEDENTARY",
  });
  assert.equal(norm.bmr, 1805);
  assert.equal(norm.maintainCalories, 2166);
  assert.equal(norm.target.calories, 1805);
});

test("ручные калории и вода не перезаписываются авторасчётом", () => {
  const auto = resolveDayNorm({
    weightKg: 85,
    goal: "LOSE",
    pace: "HEALTHY",
    sex: "MALE",
    heightCm: 180,
    birthYear: YEAR - 35,
    activity: "LIGHT",
  });
  const manual = resolveDayNorm({
    weightKg: 85,
    goal: "LOSE",
    pace: "HEALTHY",
    sex: "MALE",
    heightCm: 180,
    birthYear: YEAR - 35,
    activity: "LIGHT",
    waterTargetMl: 1800,
    fiberTargetG: 40,
    manual: { calories: 1900, protein: 150 },
  });
  assert.notEqual(auto.target.calories, 1900);
  assert.equal(manual.target.calories, 1900);
  assert.equal(manual.target.protein, 150);
  assert.equal(manual.target.waterMl, 1800);
  assert.equal(manual.target.fiber, 40);
  assert.equal(manual.manual, true);
  assert.ok(Math.abs(macrosSum(manual.target) - manual.target.calories) <= manual.target.calories * 0.02);
});

test("мужчина 37 лет 126,6 кг 185 см, похудение FAST: половина велотренировки", () => {
  const profile = {
    weightKg: 126.6,
    sex: "MALE" as const,
    heightCm: 185,
    birthYear: YEAR - 37,
    goal: "LOSE" as const,
    pace: "FAST" as const,
  };
  assert.equal(macroWeightKg(profile.weightKg, profile.sex, profile.heightCm), 102.7);
  const rest = resolveDayNorm(profile);
  const gym = resolveDayNorm({ ...profile, burnKcal: 509, trainingDay: true });
  assert.equal(rest.bmr, 2242);
  assert.equal(rest.maintainCalories, 3083);
  assert.equal(rest.target.calories, 2466);
  assert.equal(rest.target.protein, 164.3);
  assert.equal(rest.target.fat, 82.2);
  assert.equal(rest.target.carbs, 267.3);
  assert.equal(rest.target.fiber, 35);
  assert.equal(rest.target.sugar, 62);
  assert.equal(rest.target.waterMl, 3668);
  assert.equal(rest.training, null);

  assert.equal(gym.target.calories, 2721);
  assert.equal(gym.training?.baseCalories, 2466);
  assert.equal(gym.training?.calorieBonusKcal, 255);
  assert.equal(gym.training?.burnKcal, 509);
  assert.equal(gym.target.protein, 184.8);
  assert.equal(gym.target.fat, 82.2);
  assert.equal(gym.target.carbs, 310.5);
  assert.equal(gym.target.fiber, 38);
  assert.equal(gym.target.sugar, 68);
  assert.equal(gym.target.waterMl, 4168);
  assert.ok(Math.abs(macrosSum(gym.target) - gym.target.calories) <= 1);
  assert.ok(Math.abs(macrosSum(rest.target) - rest.target.calories) <= 1);

  const holdRest = resolveDayNorm({ ...profile, goal: "MAINTAIN", pace: null });
  const holdGym = resolveDayNorm({
    ...profile,
    goal: "MAINTAIN",
    pace: null,
    burnKcal: 509,
    trainingDay: true,
  });
  assert.equal(holdRest.target.calories, 3083);
  assert.equal(holdGym.training?.calorieBonusKcal, 509);
  assert.equal(holdGym.training?.baseCalories, 3083);
  assert.equal(holdGym.target.calories, 3592);
  assert.equal(holdGym.target.waterMl, 4168);

  const gainRest = resolveDayNorm({ ...profile, goal: "GAIN", pace: "HEALTHY" });
  const gainGym = resolveDayNorm({
    ...profile,
    goal: "GAIN",
    pace: "HEALTHY",
    burnKcal: 509,
    trainingDay: true,
  });
  assert.equal(gainGym.training?.calorieBonusKcal, 509);
  assert.equal(gainGym.target.calories, gainRest.target.calories + 509);

  for (const pace of ["SIMPLE", "HEALTHY", "FAST"] as const) {
    const base = resolveDayNorm({ ...profile, pace });
    const day = resolveDayNorm({ ...profile, pace, burnKcal: 509, trainingDay: true });
    assert.equal(day.training?.calorieBonusKcal, 255, pace);
    assert.equal(day.target.calories, base.target.calories + 255, pace);
    assert.ok(day.target.protein > base.target.protein, pace);
  }

  const manual = resolveDayNorm({
    ...profile,
    burnKcal: 509,
    trainingDay: true,
    waterTargetMl: 1800,
    manual: { calories: 1900 },
  });
  assert.equal(manual.target.calories, 1900);
  assert.equal(manual.target.waterMl, 1800);
  assert.equal(manual.manual, true);
});

test("план профиля и день без зала — одно значение", () => {
  const profile = {
    goal: "LOSE" as const,
    goalPace: "HEALTHY" as const,
    sex: "MALE" as const,
    heightCm: 180,
    birthYear: YEAR - 35,
    activityLevel: "LIGHT" as const,
  };
  const plan = resolvePlanNorm(85, profile);
  const day = resolveDayNorm({
    weightKg: 85,
    goal: "LOSE",
    pace: "HEALTHY",
    sex: "MALE",
    heightCm: 180,
    birthYear: YEAR - 35,
    activity: "LIGHT",
  });
  const legacy = recommendDietForProfile(85, profile);
  assert.equal(plan?.target.calories, day.target.calories);
  assert.equal(plan?.target.protein, day.target.protein);
  assert.equal(plan?.target.fat, day.target.fat);
  assert.equal(plan?.target.carbs, day.target.carbs);
  assert.equal(legacy?.calories, day.target.calories);
  assert.equal(legacy?.protein, day.target.protein);
});

test("карточка, идеи, график, бейджи, пуши и онбординг берут одну функцию", () => {
  const files = [
    "src/lib/day-meals.ts",
    "src/app/api/suggestions/route.ts",
    "src/app/api/stats/route.ts",
    "src/app/api/daily-summary/route.ts",
    "src/app/api/badges/route.ts",
    "src/app/api/challenges/route.ts",
    "src/app/api/motivation-tip/route.ts",
    "src/app/api/weekly-report/route.ts",
    "src/app/api/weekly-digest-tip/route.ts",
    "src/app/api/cron/reminders/route.ts",
    "src/lib/weekly-digest.ts",
    "src/lib/challenge-progress.ts",
    "src/lib/push-reminders.ts",
    "src/lib/gym-reward-grant.ts",
    "src/lib/chest-eligibility.ts",
    "src/components/OnboardingOverlay.tsx",
    "src/components/ProfileForm.tsx",
  ];
  for (const file of files) {
    const source = readFileSync(new URL(`../../${file}`, import.meta.url), "utf8");
    assert.match(source, /resolveDayNorm|loadDayNorm|resolvePlanNorm/, file);
    assert.doesNotMatch(source, /recommendDietForProfile\(/, file);
  }
});
