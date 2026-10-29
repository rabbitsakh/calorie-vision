import assert from "node:assert/strict";
import { test } from "node:test";
import {
  buildCapacitorReminderSchedule,
  CAP_REMINDER_IDS,
  checkCapacitorNotificationPermission,
  cvReminders,
  diarySnapshotFromRationDay,
  enableCapacitorLocalReminders,
  GYM_QUIET_UNTIL_KEY,
  GYM_REMINDER_SUPPRESS_DATE_KEY,
  isHourInGymQuiet,
  localReminderCopy,
  requestCapacitorNotificationPermission,
  suppressGymReminderForDate,
  toCapacitorWeekday,
} from "./capacitor-local-reminders.ts";
import { quietFirstRunPrefs } from "./push-reminder-schedule.ts";

function installStorage() {
  const map = new Map<string, string>();
  Object.defineProperty(globalThis, "localStorage", {
    value: {
      getItem: (k: string) => map.get(k) ?? null,
      setItem: (k: string, v: string) => {
        map.set(k, v);
      },
      removeItem: (k: string) => {
        map.delete(k);
      },
      clear: () => map.clear(),
      key: () => null,
      get length() {
        return map.size;
      },
    },
    configurable: true,
  });
  map.delete(GYM_REMINDER_SUPPRESS_DATE_KEY);
}

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

test("buildCapacitorReminderSchedule omits gym when suppressed for diary date", () => {
  installStorage();
  suppressGymReminderForDate("2026-10-27");
  const snap = diarySnapshotFromRationDay({
    date: "2026-10-27",
    meals: { entries: [], totalCalories: 0, target: { calories: 1800 } },
    water: { totalMl: 0, target: 2000 },
    streak: { streak: 0, streakBeforeToday: 0, loggedToday: false },
  });
  const items = buildCapacitorReminderSchedule(
    { gym: { enabled: true, hour: 10 }, lunch: { enabled: true, hour: 13 } },
    null,
    null,
    snap,
  );
  assert.ok(!items.some((i) => i.kind === "gym"));
  assert.ok(items.some((i) => i.kind === "lunch"));
});

test("localReminderCopy gym does not say continue", () => {
  const copy = localReminderCopy("gym");
  assert.doesNotMatch(copy.body, /продолж/i);
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

test("cvReminders prefers window.CvReminders over Cap plugin stubs", async () => {
  const g = globalThis as typeof globalThis & {
    window?: {
      CvReminders?: {
        checkPermission: () => string;
        requestPermission: () => void;
        createChannel: () => void;
        schedule: (json: string) => string;
        cancelAll: () => void;
        fireTest: () => string;
      };
      __cvOnNotificationPermission?: (status: string) => void;
      setTimeout: typeof setTimeout;
      clearTimeout: typeof clearTimeout;
    };
  };
  const prev = g.window;
  let scheduled = "";
  g.window = {
    setTimeout: globalThis.setTimeout.bind(globalThis),
    clearTimeout: globalThis.clearTimeout.bind(globalThis),
    CvReminders: {
      checkPermission: () => "prompt",
      requestPermission: () => {
        queueMicrotask(() => g.window!.__cvOnNotificationPermission?.("granted"));
      },
      createChannel: () => undefined,
      schedule: (json: string) => {
        scheduled = json;
        return "ok:1";
      },
      cancelAll: () => undefined,
      fireTest: () => "ok",
    },
  };
  try {
    assert.ok(cvReminders());
    assert.equal(await checkCapacitorNotificationPermission(), "prompt");
    assert.equal(await requestCapacitorNotificationPermission(), "granted");
    const enabled = await enableCapacitorLocalReminders(
      { lunch: { enabled: true, hour: 13 } },
      null,
      null,
    );
    assert.equal(enabled.ok, true);
    assert.ok(scheduled.includes('"hour":13'));
  } finally {
    g.window = prev;
  }
});

test("isHourInGymQuiet: mutes slots from now until quiet end, same day only", () => {
  const now = new Date(2026, 9, 29, 7, 20);
  const until = new Date(2026, 9, 29, 9, 50).getTime();
  assert.equal(isHourInGymQuiet(7, until, now), true);
  assert.equal(isHourInGymQuiet(9, until, now), true);
  assert.equal(isHourInGymQuiet(10, until, now), false);
  assert.equal(isHourInGymQuiet(6, until, now), false);
  assert.equal(isHourInGymQuiet(8, now.getTime() - 1, now), false);
  assert.equal(isHourInGymQuiet(8, null, now), false);
});

test("buildCapacitorReminderSchedule: live gym session drops meal slots for now", () => {
  installStorage();
  const h = new Date().getHours();
  localStorage.setItem(GYM_QUIET_UNTIL_KEY, String(Date.now() + 60 * 60_000));
  const prefs = { lunch: { enabled: true, hour: h } } as never;
  const muted = buildCapacitorReminderSchedule(prefs, null, null, null);
  assert.equal(muted.some((i) => i.kind === "lunch"), false);
  localStorage.removeItem(GYM_QUIET_UNTIL_KEY);
  const restored = buildCapacitorReminderSchedule(prefs, null, null, null);
  assert.equal(restored.some((i) => i.kind === "lunch"), true);
});
