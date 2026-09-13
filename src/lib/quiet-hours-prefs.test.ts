import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import {
  QUIET_HOURS_END_KEY,
  QUIET_HOURS_START_KEY,
  QUIET_HOURS_TZ_KEY,
  areCelebrationsInQuietHours,
  getQuietHoursPrefs,
  getQuietHoursTimezone,
  quietHoursLocalHour,
  syncQuietHoursPrefs,
  syncQuietHoursTimezone,
} from "./quiet-hours-prefs.ts";

const store = new Map<string, string>();

const memoryStorage = {
  getItem(key: string) {
    return store.get(key) ?? null;
  },
  setItem(key: string, value: string) {
    store.set(key, value);
  },
  removeItem(key: string) {
    store.delete(key);
  },
} as Storage;

afterEach(() => {
  store.clear();
});

test("syncQuietHoursPrefs stores and clears quiet hours", () => {
  (globalThis as { localStorage?: Storage }).localStorage = memoryStorage;

  syncQuietHoursPrefs(22, 7);
  assert.deepEqual(getQuietHoursPrefs(), { start: 22, end: 7 });
  assert.equal(store.get(QUIET_HOURS_START_KEY), "22");
  assert.equal(store.get(QUIET_HOURS_END_KEY), "7");

  syncQuietHoursPrefs(null, null);
  assert.deepEqual(getQuietHoursPrefs(), { start: null, end: null });
  assert.equal(store.has(QUIET_HOURS_START_KEY), false);
});

test("syncQuietHoursTimezone mirrors account TZ for celebration quiet hours", () => {
  (globalThis as { localStorage?: Storage }).localStorage = memoryStorage;

  syncQuietHoursTimezone("Asia/Yekaterinburg");
  assert.equal(getQuietHoursTimezone(), "Asia/Yekaterinburg");
  assert.equal(store.get(QUIET_HOURS_TZ_KEY), "Asia/Yekaterinburg");

  syncQuietHoursTimezone(null);
  assert.equal(getQuietHoursTimezone(), null);
  assert.equal(store.has(QUIET_HOURS_TZ_KEY), false);
});

test("areCelebrationsInQuietHours uses account timezone, not device wall clock", () => {
  (globalThis as { localStorage?: Storage }).localStorage = memoryStorage;
  syncQuietHoursPrefs(22, 7);
  // 19:00 UTC = 22:00 Europe/Moscow → inside quiet hours
  syncQuietHoursTimezone("Europe/Moscow");
  const moscowQuiet = new Date("2026-01-01T19:00:00.000Z");
  assert.equal(quietHoursLocalHour(moscowQuiet), 22);
  assert.equal(areCelebrationsInQuietHours(moscowQuiet), true);

  // Same instant in Asia/Sakhalin is 06:00 → still quiet (22–7 wraps)
  syncQuietHoursTimezone("Asia/Sakhalin");
  assert.equal(quietHoursLocalHour(moscowQuiet), 6);
  assert.equal(areCelebrationsInQuietHours(moscowQuiet), true);

  // 09:00 UTC = 12:00 Moscow → outside quiet hours
  const moscowNoon = new Date("2026-01-01T09:00:00.000Z");
  syncQuietHoursTimezone("Europe/Moscow");
  assert.equal(quietHoursLocalHour(moscowNoon), 12);
  assert.equal(areCelebrationsInQuietHours(moscowNoon), false);
});
