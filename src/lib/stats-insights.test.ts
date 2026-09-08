import assert from "node:assert/strict";
import { test } from "node:test";
import {
  buildMoodFoodInsight,
  buildPrimaryStatsInsight,
  buildWeekSummary,
  dayVsCorridor,
  detectCalorieCorridorStreak,
  expectedKgPerWeek,
  forecastGoalDate,
} from "@/lib/stats-insights";

test("dayVsCorridor uses ±8% band", () => {
  assert.equal(dayVsCorridor(2000, 2000), "in");
  assert.equal(dayVsCorridor(1850, 2000), "in");
  assert.equal(dayVsCorridor(2200, 2000), "above");
  assert.equal(dayVsCorridor(1700, 2000), "below");
  assert.equal(dayVsCorridor(0, 2000), "empty");
});

test("detectCalorieCorridorStreak finds 3 days above target", () => {
  const alert = detectCalorieCorridorStreak(
    [
      { date: "2026-08-18", calories: 2000 },
      { date: "2026-08-19", calories: 2400 },
      { date: "2026-08-20", calories: 2300 },
      { date: "2026-08-21", calories: 2500 },
    ],
    2000,
    3,
  );
  assert.ok(alert);
  assert.equal(alert!.direction, "above");
  assert.equal(alert!.days, 3);
  assert.match(alert!.message, /подряд выше цели/);
});

test("detectCalorieCorridorStreak finds 3 days below target", () => {
  const alert = detectCalorieCorridorStreak(
    [
      { date: "2026-08-19", calories: 1400 },
      { date: "2026-08-20", calories: 1500 },
      { date: "2026-08-21", calories: 1450 },
    ],
    2000,
    3,
  );
  assert.ok(alert);
  assert.equal(alert!.direction, "below");
  assert.match(alert!.message, /подряд ниже цели/);
});

test("detectCalorieCorridorStreak ignores in-corridor break", () => {
  const alert = detectCalorieCorridorStreak(
    [
      { date: "2026-08-19", calories: 2400 },
      { date: "2026-08-20", calories: 2000 },
      { date: "2026-08-21", calories: 2500 },
    ],
    2000,
    3,
  );
  assert.equal(alert, null);
});

test("buildWeekSummary returns headline and corridor days", () => {
  const summary = buildWeekSummary(
    [
      { date: "2026-08-18", calories: 2000, weightKg: 80 },
      { date: "2026-08-19", calories: 2100, weightKg: null },
      { date: "2026-08-20", calories: 0, weightKg: null },
      { date: "2026-08-21", calories: 1900, weightKg: 79.5 },
    ],
    2000,
  );
  assert.ok(summary);
  assert.equal(summary!.daysLogged, 3);
  assert.equal(summary!.daysInCorridor, 3);
  assert.equal(summary!.weightChangeKg, -0.5);
  assert.match(summary!.headline, /среднее/);
});

test("buildPrimaryStatsInsight prefers corridor over week summary", () => {
  const insight = buildPrimaryStatsInsight({
    corridorAlert: {
      direction: "above",
      days: 3,
      avgDiff: 400,
      message: "Уже 3 дня подряд выше цели примерно на 400 ккал.",
    },
    weekSummary: {
      daysLogged: 5,
      daysInCorridor: 2,
      avgCalories: 2100,
      calorieTarget: 2000,
      weightChangeKg: null,
      bestDay: null,
      headline: "За 7 дней: среднее 2100 ккал",
    },
    moodInsight: "Настроение и еда tip",
  });
  assert.ok(insight);
  assert.equal(insight!.tone, "amber");
  assert.equal(insight!.title, "Выше цели 3+ дня");
  assert.match(insight!.body, /выше цели/);
});

test("buildPrimaryStatsInsight falls back to week headline with one detail", () => {
  const insight = buildPrimaryStatsInsight({
    weekSummary: {
      daysLogged: 5,
      daysInCorridor: 4,
      avgCalories: 1950,
      calorieTarget: 2000,
      weightChangeKg: -0.4,
      bestDay: { date: "2026-08-20", calories: 1980 },
      headline: "За 7 дней: среднее 1950 ккал · в коридоре 4 из 5",
    },
  });
  assert.ok(insight);
  assert.equal(insight!.tone, "teal");
  assert.equal(insight!.title, "Итоги недели");
  assert.match(insight!.body, /среднее 1950/);
  assert.match(insight!.detail ?? "", /Ближе всего к цели/);
});

test("buildPrimaryStatsInsight uses WoW one-liner when no week summary", () => {
  const insight = buildPrimaryStatsInsight({
    weekOverWeek: { deltaAvgCalories: -120 },
  });
  assert.ok(insight);
  assert.equal(insight!.title, "Сравнение недель");
  assert.match(insight!.body, /ниже прошлой/);
});

test("buildPrimaryStatsInsight uses mood tip last", () => {
  const insight = buildPrimaryStatsInsight({
    moodInsight: "В дни с настроением 4–5 вы чаще попадали в цель.",
  });
  assert.ok(insight);
  assert.equal(insight!.title, "Настроение и еда");
  assert.match(insight!.body, /попадали в цель/);
});

test("buildPrimaryStatsInsight returns null when empty", () => {
  assert.equal(buildPrimaryStatsInsight({}), null);
});

test("buildMoodFoodInsight is actionable for high-mood correlation", () => {
  const mealByDate = new Map([
    ["2026-08-18", 2000],
    ["2026-08-19", 2050],
    ["2026-08-20", 2800],
    ["2026-08-21", 1950],
  ]);
  const text = buildMoodFoodInsight(
    [
      { date: "2026-08-18", mood: 5 },
      { date: "2026-08-19", mood: 4 },
      { date: "2026-08-20", mood: 1 },
      { date: "2026-08-21", mood: 5 },
    ],
    mealByDate,
    2000,
  );
  assert.ok(text);
  assert.match(text!, /Замечайте|повторяйте|план Б|чек-in|Отмечайте/i);
});

test("expectedKgPerWeek signs by goal", () => {
  assert.equal(expectedKgPerWeek("LOSE", "HEALTHY"), -0.5);
  assert.equal(expectedKgPerWeek("GAIN", "FAST"), 0.75);
  assert.equal(expectedKgPerWeek("MAINTAIN", "HEALTHY"), null);
});

test("forecastGoalDate uses pace when no trend", () => {
  const forecast = forecastGoalDate({
    currentKg: 80,
    targetKg: 75,
    goal: "LOSE",
    pace: "HEALTHY",
    today: new Date("2026-08-24T12:00:00"),
  });
  assert.ok(forecast);
  assert.equal(forecast!.source, "pace");
  assert.equal(forecast!.weeksRemaining, 10);
  assert.match(forecast!.message, /Прогноз/);
});

test("forecastGoalDate prefers measured trend toward target", () => {
  const forecast = forecastGoalDate({
    currentKg: 80,
    targetKg: 75,
    goal: "LOSE",
    pace: "SIMPLE",
    observedChangeKg: -1.4,
    observedDays: 14,
    today: new Date("2026-08-24T12:00:00"),
  });
  assert.ok(forecast);
  assert.equal(forecast!.source, "trend");
  assert.equal(forecast!.kgPerWeek, -0.7);
});

test("forecastGoalDate returns null when already at target", () => {
  assert.equal(
    forecastGoalDate({
      currentKg: 75,
      targetKg: 75,
      goal: "LOSE",
      pace: "HEALTHY",
    }),
    null,
  );
});
