import assert from "node:assert/strict";
import { test } from "node:test";
import {
  cacheLoggedDaysTotal,
  claimOpenCameraAfterOnboarding,
  getCachedLoggedDaysTotal,
  isFirstWeekQuiet,
  markFirstShareNudgeSeen,
  markOpenCameraAfterOnboarding,
  markSevenDayAhaSeen,
  shouldShowFirstShareNudge,
  shouldShowSevenDayAha,
} from "./first-hour-trust.ts";

function memoryStorage(): Storage {
  const map = new Map<string, string>();
  return {
    get length() {
      return map.size;
    },
    clear() {
      map.clear();
    },
    getItem(key: string) {
      return map.has(key) ? map.get(key)! : null;
    },
    key(index: number) {
      return [...map.keys()][index] ?? null;
    },
    removeItem(key: string) {
      map.delete(key);
    },
    setItem(key: string, value: string) {
      map.set(key, String(value));
    },
  };
}

function withStorage(run: () => void) {
  const storage = memoryStorage();
  (globalThis as { localStorage?: Storage }).localStorage = storage;
  try {
    run();
  } finally {
    delete (globalThis as { localStorage?: Storage }).localStorage;
  }
}

test("open camera after onboarding is one-shot", () => {
  withStorage(() => {
    assert.equal(claimOpenCameraAfterOnboarding(), false);
    markOpenCameraAfterOnboarding();
    assert.equal(claimOpenCameraAfterOnboarding(), true);
    assert.equal(claimOpenCameraAfterOnboarding(), false);
  });
});

test("first share nudge needs a meal and is once", () => {
  withStorage(() => {
    assert.equal(shouldShowFirstShareNudge(0), false);
    assert.equal(shouldShowFirstShareNudge(1), true);
    markFirstShareNudgeSeen();
    assert.equal(shouldShowFirstShareNudge(3), false);
  });
});

test("first week quiet uses cached logged days", () => {
  withStorage(() => {
    assert.equal(isFirstWeekQuiet(3), true);
    cacheLoggedDaysTotal(2);
    assert.equal(getCachedLoggedDaysTotal(), 2);
    assert.equal(isFirstWeekQuiet(3), true);
    cacheLoggedDaysTotal(5);
    assert.equal(isFirstWeekQuiet(3), false);
  });
});

test("seven day aha gates on count and seen flag", () => {
  withStorage(() => {
    assert.equal(shouldShowSevenDayAha(6), false);
    assert.equal(shouldShowSevenDayAha(7), true);
    markSevenDayAhaSeen();
    assert.equal(shouldShowSevenDayAha(10), false);
  });
});
