import assert from "node:assert/strict";
import { test } from "node:test";
import {
  consumeSoftCelebrationSlot,
  getSoftCelebrationCount,
  isSoftCelebrationCapReached,
  isSoftCelebrationQuietBlocked,
  isSoftCelebrationSeen,
  isSoftCelebrationSuppressed,
  markSoftCelebrationSeen,
  softCelebrationDailyCap,
  SOFT_CELEB_DAILY_CAP,
  SOFT_CELEB_FIRST_WEEK_CAP,
} from "./soft-celebration.ts";
import { GAMIFICATION_QUIET_KEY } from "./gamification-quiet.ts";
import { cacheLoggedDaysTotal } from "./first-hour-trust.ts";

test("marks day-opened celebration as seen in localStorage", () => {
  const store = new Map<string, string>();
  const memoryStorage = {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => {
      store.set(key, value);
    },
    removeItem: (key: string) => {
      store.delete(key);
    },
  };

  // soft-celebration reads window.localStorage; stub a minimal window.
  (globalThis as { window?: unknown }).window = {
    localStorage: memoryStorage,
  };

  assert.equal(isSoftCelebrationSeen("day-opened", "2026-08-20"), false);
  markSoftCelebrationSeen("day-opened", "2026-08-20");
  assert.equal(isSoftCelebrationSeen("day-opened", "2026-08-20"), true);
  assert.equal(isSoftCelebrationSeen("day-opened", "2026-08-21"), false);

  delete (globalThis as { window?: unknown }).window;
});

test("quiet blocked when gamification quiet is on", () => {
  const store = new Map<string, string>();
  const memoryStorage = {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => {
      store.set(key, value);
    },
    removeItem: (key: string) => {
      store.delete(key);
    },
  };
  (globalThis as { window?: unknown }).window = {
    localStorage: memoryStorage,
  };

  assert.equal(isSoftCelebrationQuietBlocked(), false);
  store.set(GAMIFICATION_QUIET_KEY, "1");
  assert.equal(isSoftCelebrationQuietBlocked(), true);

  delete (globalThis as { window?: unknown }).window;
});

test("soft celebration yields to fullscreen gate", () => {
  assert.equal(
    isSoftCelebrationSuppressed({ open: true, quietBlocked: false, fullscreenActiveId: null }),
    false,
  );
  assert.equal(
    isSoftCelebrationSuppressed({ open: true, quietBlocked: false, fullscreenActiveId: "fs-1" }),
    true,
  );
  assert.equal(
    isSoftCelebrationSuppressed({ open: false, quietBlocked: false, fullscreenActiveId: null }),
    true,
  );
  assert.equal(
    isSoftCelebrationSuppressed({ open: true, quietBlocked: true, fullscreenActiveId: null }),
    true,
  );
});

test("soft celebration daily budget caps cards per day", () => {
  const store = new Map<string, string>();
  const memoryStorage = {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => {
      store.set(key, value);
    },
    removeItem: (key: string) => {
      store.delete(key);
    },
  };
  (globalThis as { window?: unknown }).window = {
    localStorage: memoryStorage,
  };

  // Past first week → full soft budget.
  cacheLoggedDaysTotal(10);
  assert.equal(softCelebrationDailyCap(), SOFT_CELEB_DAILY_CAP);
  assert.equal(isSoftCelebrationCapReached("2026-10-03"), false);
  for (let i = 0; i < SOFT_CELEB_DAILY_CAP; i++) {
    assert.equal(consumeSoftCelebrationSlot("2026-10-03"), true);
  }
  assert.equal(getSoftCelebrationCount("2026-10-03"), SOFT_CELEB_DAILY_CAP);
  assert.equal(isSoftCelebrationCapReached("2026-10-03"), true);
  assert.equal(consumeSoftCelebrationSlot("2026-10-03"), false);

  // First week → tighter budget.
  cacheLoggedDaysTotal(2);
  assert.equal(softCelebrationDailyCap(), SOFT_CELEB_FIRST_WEEK_CAP);
  assert.equal(consumeSoftCelebrationSlot("2026-10-04"), true);
  assert.equal(consumeSoftCelebrationSlot("2026-10-04"), false);

  delete (globalThis as { window?: unknown }).window;
});
