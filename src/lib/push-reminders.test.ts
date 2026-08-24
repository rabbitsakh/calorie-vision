import assert from "node:assert/strict";
import { test } from "node:test";
import {
  buildReminderPayload,
  computeLastWeekStats,
  computeStreakStats,
  localHour,
  localWeekday,
  pickPushCopyVariant,
  remindersForLocalTime,
  REMINDER_SCHEDULE,
  resolvePushTimezone,
  WATER_DAILY_TARGET_ML,
  type ReminderKind,
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
  assert.equal(resolvePushTimezone("Not/AZone"), "Europe/Moscow");
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

test("Sakhalin local hour is +8 from Moscow schedule slots", () => {
  // Check-in at 21:00 Moscow = 05:00 Sakhalin — the bug from wrong default TZ.
  const moscowCheckin = new Date("2026-08-22T18:00:00Z"); // 21:00 Europe/Moscow
  assert.equal(localHour("Europe/Moscow", moscowCheckin), 21);
  assert.equal(localHour("Asia/Sakhalin", moscowCheckin), 5);
  assert.deepEqual(remindersForLocalTime(21, 5), ["checkin"]);
  assert.deepEqual(remindersForLocalTime(5, 5), []);

  const moscowWater = new Date("2026-08-22T11:00:00Z"); // 14:00 Europe/Moscow
  assert.equal(localHour("Europe/Moscow", moscowWater), 14);
  assert.equal(localHour("Asia/Sakhalin", moscowWater), 22);
});

test("localHour midnight normalizes within 0-23", () => {
  const moscowMidnight = new Date("2026-08-22T21:00:00Z");
  assert.equal(localHour("Europe/Moscow", moscowMidnight), 0);
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

test("pickPushCopyVariant is stable for same user and kind", () => {
  const a = pickPushCopyVariant("user-abc", "breakfast");
  const b = pickPushCopyVariant("user-abc", "breakfast");
  assert.equal(a, b);
  assert.ok(a === "A" || a === "B");
});

test("pickPushCopyVariant covers both buckets across users", () => {
  const kinds: ReminderKind[] = [
    "breakfast",
    "lunch",
    "water_midday",
    "water_evening",
    "calories",
    "streak",
    "checkin",
    "weekly",
  ];
  const seen = new Set<string>();
  for (let i = 0; i < 40; i += 1) {
    for (const kind of kinds) {
      seen.add(pickPushCopyVariant(`user-${i}`, kind));
    }
  }
  assert.deepEqual([...seen].sort(), ["A", "B"]);
});

test("push copy A/B differs for breakfast title", () => {
  const a = buildReminderPayload("breakfast", baseCtx, { variant: "A" });
  const b = buildReminderPayload("breakfast", baseCtx, { variant: "B" });
  assert.ok(a && b);
  assert.notEqual(a.title, b.title);
  assert.match(a.body, /5 дн/);
  assert.match(b.body, /5 дн/);
});

test("push copy A/B differs for streak at risk", () => {
  const a = buildReminderPayload("streak", baseCtx, { variant: "A" });
  const b = buildReminderPayload("streak", baseCtx, { variant: "B" });
  assert.ok(a && b);
  assert.notEqual(a.title, b.title);
  assert.notEqual(a.body, b.body);
});

test("buildReminderPayload uses userId to pick variant", () => {
  const variant = pickPushCopyVariant("stable-user-1", "weekly");
  const viaUser = buildReminderPayload("weekly", baseCtx, { userId: "stable-user-1" });
  const viaVariant = buildReminderPayload("weekly", baseCtx, { variant });
  assert.ok(viaUser && viaVariant);
  assert.equal(viaUser.title, viaVariant.title);
  assert.equal(viaUser.body, viaVariant.body);
});

test("default buildReminderPayload stays on variant A", () => {
  const def = buildReminderPayload("checkin", baseCtx);
  const a = buildReminderPayload("checkin", baseCtx, { variant: "A" });
  assert.ok(def && a);
  assert.equal(def.title, a.title);
  assert.equal(def.body, a.body);
});

test("breakfast deep link includes meal=BREAKFAST", () => {
  const payload = buildReminderPayload("breakfast", baseCtx);
  assert.ok(payload);
  assert.equal(payload.url, "/ration?meal=BREAKFAST");
});

test("lunch deep link includes meal=LUNCH", () => {
  const payload = buildReminderPayload("lunch", { ...baseCtx, mealCount: 1, hasBreakfast: true });
  assert.ok(payload);
  assert.equal(payload.url, "/ration?meal=LUNCH");
});
