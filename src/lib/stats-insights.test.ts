import assert from "node:assert/strict";
import { test } from "node:test";
import {
  buildMoodFoodInsight,
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
