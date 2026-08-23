import assert from "node:assert/strict";
import { test } from "node:test";
import {
  buildReminderPayload,
  computeLastWeekStats,
  computeStreakStats,
  localHour,
  localWeekday,
  remindersForLocalTime,
  REMINDER_SCHEDULE,
  resolvePushTimezone,
  WATER_DAILY_TARGET_ML,
} from "./push-reminders.ts";

const baseCtx = {
  today: "2026-08-22",
  mealCount: 0,
  totalCalories: 0,
  calorieTarget: 2000,
  waterMl: 0,
  streak: 0,
  streakBeforeToday: 5,
  loggedToday: false,
  mood: null,
  hasBreakfast: false,
  hasLunch: false,
  hasDinner: false,
  daysLoggedLastWeek: 3,
  daysInLastWeek: 7,
};

test("resolvePushTimezone falls back to Europe/Moscow", () => {
  assert.equal(resolvePushTimezone(null), "Europe/Moscow");
  assert.equal(resolvePushTimezone(""), "Europe/Moscow");
  assert.equal(resolvePushTimezone("Asia/Yekaterinburg"), "Asia/Yekaterinburg");
});

test("remindersForLocalTime returns breakfast at 8", () => {
  assert.deepEqual(remindersForLocalTime(8, 1), ["breakfast"]);
});

test("remindersForLocalTime returns weekly only on Monday 9", () => {
  assert.deepEqual(remindersForLocalTime(9, 1), ["weekly"]);
  assert.deepEqual(remindersForLocalTime(9, 2), []);
});

test("schedule has 8 reminder slots", () => {
  assert.equal(REMINDER_SCHEDULE.length, 8);
});

test("breakfast reminder mentions streak when at risk", () => {
  const payload = buildReminderPayload("breakfast", baseCtx);
  assert.ok(payload);
  assert.match(payload.body, /5 дн/);
});

test("breakfast skipped when already logged", () => {
  assert.equal(
    buildReminderPayload("breakfast", { ...baseCtx, mealCount: 1, hasBreakfast: true }),
    null,
  );
});

test("water midday skipped when half target reached", () => {
  assert.equal(
    buildReminderPayload("water_midday", {
      ...baseCtx,
      waterMl: WATER_DAILY_TARGET_ML / 2,
    }),
    null,
  );
});

test("water midday includes progress", () => {
  const payload = buildReminderPayload("water_midday", { ...baseCtx, waterMl: 400 });
  assert.ok(payload);
  assert.match(payload.body, /400 мл/);
});

test("calories reminder shows target progress", () => {
  const payload = buildReminderPayload("calories", {
    ...baseCtx,
    mealCount: 2,
    totalCalories: 900,
    calorieTarget: 2000,
  });
  assert.ok(payload);
  assert.match(payload.body, /900 \/ 2000/);
});

test("streak at risk shows streak length", () => {
  const payload = buildReminderPayload("streak", baseCtx);
  assert.ok(payload);
  assert.match(payload.title, /5 дн/);
});

test("streak skipped when logged and not milestone", () => {
  assert.equal(
    buildReminderPayload("streak", {
      ...baseCtx,
      loggedToday: true,
      streak: 3,
      streakBeforeToday: 3,
    }),
    null,
  );
});

test("streak milestone when logged on day 7", () => {
  const payload = buildReminderPayload("streak", {
    ...baseCtx,
    loggedToday: true,
    streak: 7,
    streakBeforeToday: 6,
  });
  assert.ok(payload);
  assert.match(payload.title, /7 дней/);
});

test("checkin includes meal stats when present", () => {
  const payload = buildReminderPayload("checkin", {
    ...baseCtx,
    mealCount: 3,
    totalCalories: 1800,
  });
  assert.ok(payload);
  assert.match(payload.body, /1800 ккал/);
});

test("weekly skipped when last week was strong", () => {
  assert.equal(
    buildReminderPayload("weekly", { ...baseCtx, daysLoggedLastWeek: 6 }),
    null,
  );
});

test("computeStreakStats respects freezes", () => {
  const stats = computeStreakStats(["2026-08-21"], ["2026-08-20"], "2026-08-22");
  assert.equal(stats.loggedToday, false);
  assert.equal(stats.streakBeforeToday, 2);
});

test("computeLastWeekStats counts meal days in previous week", () => {
  const stats = computeLastWeekStats(
    ["2026-08-11", "2026-08-13", "2026-08-15"],
    "2026-08-18",
    "UTC",
  );
  assert.equal(stats.daysLoggedLastWeek, 3);
  assert.equal(stats.daysInLastWeek, 7);
});

test("localHour and weekday use timezone", () => {
  const noonUtc = new Date("2026-08-22T12:00:00Z");
  assert.equal(localHour("Europe/Moscow", noonUtc), 15);
  assert.equal(typeof localWeekday("Europe/Moscow", noonUtc), "number");
});
