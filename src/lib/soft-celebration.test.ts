import assert from "node:assert/strict";
import { test } from "node:test";
import {
  isSoftCelebrationQuietBlocked,
  isSoftCelebrationSeen,
  markSoftCelebrationSeen,
} from "./soft-celebration.ts";
import { GAMIFICATION_QUIET_KEY } from "./gamification-quiet.ts";

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
