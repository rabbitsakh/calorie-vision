import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import {
  QUIET_HOURS_END_KEY,
  QUIET_HOURS_START_KEY,
  areCelebrationsInQuietHours,
  getQuietHoursPrefs,
  syncQuietHoursPrefs,
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

test("areCelebrationsInQuietHours respects mirrored prefs", () => {
  (globalThis as { localStorage?: Storage }).localStorage = memoryStorage;
  syncQuietHoursPrefs(22, 7);

  assert.equal(areCelebrationsInQuietHours(new Date(2026, 0, 1, 23, 0, 0)), true);
  assert.equal(areCelebrationsInQuietHours(new Date(2026, 0, 1, 6, 0, 0)), true);
  assert.equal(areCelebrationsInQuietHours(new Date(2026, 0, 1, 12, 0, 0)), false);
});
