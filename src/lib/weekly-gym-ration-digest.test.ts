import assert from "node:assert/strict";
import { test } from "node:test";
import {
  buildWeeklyGymRationDigest,
  ruleWeeklyDigestTip,
} from "./weekly-gym-ration-digest.ts";

const base = {
  weekLabel: "6 окт. — 12 окт.",
  daysLogged: 5,
  avgCalories: 1900,
  calorieTarget: 2000,
  avgProtein: 80,
  proteinTarget: 120,
  sessionCount: 0,
  weeklyTonnage: 0,
  weekTrendPct: null as number | null,
  streak: 4,
};

test("empty week → null", () => {
  assert.equal(
    buildWeeklyGymRationDigest({
      ...base,
      daysLogged: 0,
      sessionCount: 0,
      avgProtein: 0,
      avgCalories: 0,
    }),
    null,
  );
});

test("gym + protein gap → protein focus", () => {
  const d = buildWeeklyGymRationDigest({
    ...base,
    sessionCount: 3,
    weeklyTonnage: 12000,
    avgProtein: 70,
    proteinTarget: 130,
  });
  assert.ok(d);
  assert.match(d!.headline, /белок/i);
  assert.equal(d!.steps.length, 2);
  assert.match(d!.steps[0]!, /белк/i);
});

test("gym tonnage down → hold rhythm", () => {
  const d = buildWeeklyGymRationDigest({
    ...base,
    sessionCount: 2,
    weeklyTonnage: 8000,
    weekTrendPct: -15,
    avgProtein: 120,
    proteinTarget: 120,
  });
  assert.ok(d);
  assert.match(d!.headline, /просела|ритм/i);
  assert.match(d!.steps.join(" "), /трениров/);
});

test("sparse diary → regularity step", () => {
  const d = buildWeeklyGymRationDigest({
    ...base,
    daysLogged: 2,
    sessionCount: 0,
    avgProtein: 40,
  });
  assert.ok(d);
  assert.match(d!.headline, /регулярность/i);
  assert.match(d!.steps[0]!, /2 из 7/);
});

test("ruleWeeklyDigestTip uses first step", () => {
  const tip = ruleWeeklyDigestTip({
    headline: "Заголовок",
    steps: ["Шаг один про белок после зала."],
  });
  assert.match(tip, /белок/);
});
