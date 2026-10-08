import assert from "node:assert/strict";
import { test } from "node:test";
import {
  clearPostWorkoutNudge,
  hasFreshPostWorkoutNudge,
  markPostWorkoutNudge,
  POST_WORKOUT_AT_KEY,
  shouldClearPostWorkoutNudge,
} from "./post-workout-nudge.ts";

function mockStorage() {
  const map = new Map<string, string>();
  const storage = {
    getItem(key: string) {
      return map.has(key) ? map.get(key)! : null;
    },
    setItem(key: string, value: string) {
      map.set(key, value);
    },
    removeItem(key: string) {
      map.delete(key);
    },
  };
  Object.defineProperty(globalThis, "localStorage", {
    value: storage,
    configurable: true,
  });
  Object.defineProperty(globalThis, "sessionStorage", {
    value: {
      getItem: () => null,
      setItem: () => undefined,
      removeItem: () => undefined,
    },
    configurable: true,
  });
  map.clear();
  return map;
}

test("mark/has/clear post-workout nudge persists in localStorage", () => {
  const map = mockStorage();
  const now = 1_700_000_000_000;
  assert.equal(hasFreshPostWorkoutNudge(now), false);
  markPostWorkoutNudge(now);
  assert.equal(map.get(POST_WORKOUT_AT_KEY), String(now));
  assert.equal(hasFreshPostWorkoutNudge(now + 60_000), true);
  assert.equal(hasFreshPostWorkoutNudge(now + 7 * 60 * 60 * 1000), false);
  clearPostWorkoutNudge();
  assert.equal(hasFreshPostWorkoutNudge(now), false);
});

test("migrates legacy sessionStorage nudge into localStorage", () => {
  const localMap = new Map<string, string>();
  const sessionMap = new Map<string, string>();
  const now = 1_700_000_000_000;
  sessionMap.set(POST_WORKOUT_AT_KEY, String(now));

  Object.defineProperty(globalThis, "localStorage", {
    value: {
      getItem: (k: string) => (localMap.has(k) ? localMap.get(k)! : null),
      setItem: (k: string, v: string) => {
        localMap.set(k, v);
      },
      removeItem: (k: string) => {
        localMap.delete(k);
      },
    },
    configurable: true,
  });
  Object.defineProperty(globalThis, "sessionStorage", {
    value: {
      getItem: (k: string) => (sessionMap.has(k) ? sessionMap.get(k)! : null),
      setItem: (k: string, v: string) => {
        sessionMap.set(k, v);
      },
      removeItem: (k: string) => {
        sessionMap.delete(k);
      },
    },
    configurable: true,
  });

  assert.equal(hasFreshPostWorkoutNudge(now + 1_000), true);
  assert.equal(localMap.get(POST_WORKOUT_AT_KEY), String(now));
  assert.equal(sessionMap.has(POST_WORKOUT_AT_KEY), false);
});

test("shouldClearPostWorkoutNudge when protein reaches soft target", () => {
  assert.equal(shouldClearPostWorkoutNudge({ protein: 90, proteinTarget: 120 }), true);
  assert.equal(shouldClearPostWorkoutNudge({ protein: 80, proteinTarget: 120 }), false);
  assert.equal(shouldClearPostWorkoutNudge({ protein: 100, proteinTarget: 0 }), false);
});
