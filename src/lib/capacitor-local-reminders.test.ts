import assert from "node:assert/strict";
import { test } from "node:test";
import {
  buildCapacitorReminderSchedule,
  CAP_REMINDER_IDS,
  diarySnapshotFromRationDay,
  localReminderCopy,
  toCapacitorWeekday,
} from "./capacitor-local-reminders.ts";
import { quietFirstRunPrefs } from "./push-reminder-schedule.ts";

test("toCapacitorWeekday maps JS Sunday=0 to Capacitor 1", () => {
  assert.equal(toCapacitorWeekday(0), 1);
  assert.equal(toCapacitorWeekday(1), 2); // Monday
  assert.equal(toCapacitorWeekday(6), 7); // Saturday
});

test("localReminderCopy covers all kinds", () => {
  for (const kind of Object.keys(CAP_REMINDER_IDS) as Array<keyof typeof CAP_REMINDER_IDS>) {
    const copy = localReminderCopy(kind);
    assert.ok(copy.title.length > 0);
    assert.ok(copy.body.length > 0);
  }
});

test("localReminderCopy uses diary snapshot for lunch and water", () => {
  const snap = diarySnapshotFromRationDay({
    date: "2026-09-25",
    meals: {
      entries: [{ mealType: "BREAKFAST" }],
      totalCalories: 420,
      target: { calories: 1800 },
    },
    water: { totalMl: 400, target: 2000 },
    streak: { streak: 3, streakBeforeToday: 2, loggedToday: true },
  });
  assert.ok(snap);
  const lunch = localReminderCopy("lunch", snap);
  assert.match(lunch.body, /420/);
  const water = localReminderCopy("water_midday", snap);
  assert.match(water.body, /400/);
  assert.match(water.body, /2000/);
});

test("buildCapacitorReminderSchedule uses quiet defaults and stable ids", () => {
  const items = buildCapacitorReminderSchedule(quietFirstRunPrefs(), null, null, null);
  const kinds = items.map((i) => i.kind).sort();
  assert.deepEqual(kinds, ["checkin", "dinner", "lunch", "reactivation", "streak", "weekly"].sort());
  for (const item of items) {
    assert.equal(item.id, CAP_REMINDER_IDS[item.kind]);
    assert.ok(item.hour >= 0 && item.hour <= 23);
  }
  const weekly = items.find((i) => i.kind === "weekly");
  assert.equal(weekly?.weekday, 1);
});

test("buildCapacitorReminderSchedule skips quiet hours", () => {
  const items = buildCapacitorReminderSchedule(
    { lunch: { enabled: true, hour: 13 }, dinner: { enabled: true, hour: 22 } },
    21,
    7,
    null,
  );
  assert.ok(items.some((i) => i.kind === "lunch"));
  assert.ok(!items.some((i) => i.kind === "dinner"));
});

test("disabled kinds are omitted", () => {
  const items = buildCapacitorReminderSchedule(
    {
      lunch: { enabled: false },
      dinner: { enabled: true, hour: 18 },
    },
    null,
    null,
    null,
  );
  assert.ok(!items.some((i) => i.kind === "lunch"));
  assert.ok(items.some((i) => i.kind === "dinner"));
});
