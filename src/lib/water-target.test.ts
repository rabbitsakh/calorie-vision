import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { resolveDayNorm } from "./day-norm.ts";
import { macroWeightKg } from "./diet.ts";
import {
  WATER_DAILY_TARGET_ML,
  displayedWaterTargetMl,
  recommendWaterMl,
  resolveWaterTargetMl,
  isValidWaterTargetMl,
} from "./water-target.ts";

test("вода считается от веса вокруг ориентира 2,5 и 2,0 л", () => {
  assert.equal(recommendWaterMl(70, "MALE"), 2500);
  assert.equal(recommendWaterMl(60, "FEMALE"), 2000);
  assert.equal(recommendWaterMl(85, "MALE"), 3036);
  assert.equal(recommendWaterMl(70, "MALE", true), 3000);
});

test("вода от расчётного веса белка: 126,6 кг и 185 см → 102,7 кг", () => {
  const basis = macroWeightKg(126.6, "MALE", 185);
  assert.equal(basis, 102.7);
  const rest = recommendWaterMl(126.6, "MALE", false, 185);
  const train = recommendWaterMl(126.6, "MALE", true, 185);
  assert.equal(rest, Math.round(basis * (2500 / 70)));
  assert.equal(rest, 3668);
  assert.equal(train, rest + 500);
  assert.equal(train, 4168);
  assert.equal(recommendWaterMl(250, "MALE", true, 230), 6000);
});

test("resolveWaterTargetMl falls back to 2000", () => {
  assert.equal(resolveWaterTargetMl(null), WATER_DAILY_TARGET_ML);
  assert.equal(resolveWaterTargetMl(undefined), WATER_DAILY_TARGET_ML);
  assert.equal(resolveWaterTargetMl(2500), 2500);
  assert.equal(resolveWaterTargetMl(100), WATER_DAILY_TARGET_ML);
});

test("стакан не подменяет расчётную норму 3700 запасными 2000", () => {
  // 103,6 кг и 186 см: 103,6 × (2500 / 70) = 3700 мл. Без ручной цели запасной путь давал 2000.
  const profile = {
    weightKg: 103.6,
    sex: "MALE" as const,
    heightCm: 186,
    birthYear: 1990,
    goal: "MAINTAIN" as const,
    activity: "LIGHT" as const,
  };
  const day = resolveDayNorm(profile);
  const onScreen = displayedWaterTargetMl({
    normWaterMl: day.target.waterMl,
    manualWaterTargetMl: null,
    weightKg: profile.weightKg,
    sex: profile.sex,
    heightCm: profile.heightCm,
  });
  const spare = resolveWaterTargetMl(null);

  assert.equal(day.target.waterMl, 3700);
  assert.equal(onScreen, 3700);
  assert.equal(spare, 2000);
  assert.notEqual(onScreen, spare);

  const afterGlass = displayedWaterTargetMl({
    normWaterMl: day.target.waterMl,
    manualWaterTargetMl: null,
    weightKg: profile.weightKg,
    sex: profile.sex,
    trainingDay: false,
    heightCm: profile.heightCm,
  });
  assert.equal(afterGlass, onScreen);

  const heavy = displayedWaterTargetMl({
    weightKg: 126.6,
    sex: "MALE",
    heightCm: 185,
  });
  assert.equal(heavy, 3668);
  assert.equal(
    displayedWaterTargetMl({
      normWaterMl: heavy,
      manualWaterTargetMl: null,
      weightKg: 126.6,
      sex: "MALE",
      heightCm: 185,
    }),
    heavy,
  );
});

test("ручная цель воды остаётся важнее расчёта от веса", () => {
  assert.equal(
    displayedWaterTargetMl({
      manualWaterTargetMl: 1800,
      weightKg: 103.6,
      sex: "MALE",
      heightCm: 186,
    }),
    1800,
  );
  assert.equal(
    displayedWaterTargetMl({
      normWaterMl: 3700,
      manualWaterTargetMl: 1800,
      weightKg: 103.6,
      sex: "MALE",
      heightCm: 186,
    }),
    3700,
  );
});

test("стакан, день, статистика и пуши берут одну норму воды", () => {
  const files: Array<{ file: string; pattern: RegExp }> = [
    { file: "src/lib/day-meals.ts", pattern: /displayedWaterTargetMl\(/ },
    { file: "src/app/api/water/route.ts", pattern: /loadDisplayedWaterTargetMl\(/ },
    { file: "src/app/api/ration-day/route.ts", pattern: /meals\.waterTargetMl/ },
    { file: "src/app/api/stats/route.ts", pattern: /loadDisplayedWaterTargetMl\(/ },
    { file: "src/app/api/cron/reminders/route.ts", pattern: /loadDisplayedWaterTargetMl\(/ },
    { file: "src/lib/chest-eligibility.ts", pattern: /loadDisplayedWaterTargetMl\(/ },
    { file: "src/lib/admin-assistant-context.ts", pattern: /day\.waterTargetMl/ },
  ];
  for (const { file, pattern } of files) {
    const source = readFileSync(new URL(`../../${file}`, import.meta.url), "utf8");
    assert.match(source, pattern, file);
  }
  const waterRoute = readFileSync(new URL("../../src/app/api/water/route.ts", import.meta.url), "utf8");
  assert.doesNotMatch(waterRoute, /resolveWaterTargetMl\(/);
  const rationDay = readFileSync(new URL("../../src/app/api/ration-day/route.ts", import.meta.url), "utf8");
  assert.doesNotMatch(rationDay, /resolveWaterTargetMl\(/);
});

test("isValidWaterTargetMl bounds", () => {
  assert.equal(isValidWaterTargetMl(500), true);
  assert.equal(isValidWaterTargetMl(6000), true);
  assert.equal(isValidWaterTargetMl(499), false);
  assert.equal(isValidWaterTargetMl(6001), false);
});
