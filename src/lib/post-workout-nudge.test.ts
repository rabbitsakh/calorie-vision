import assert from "node:assert/strict";
import { test } from "node:test";
import {
  clearPostWorkoutNudge,
  hasFreshPostWorkoutNudge,
  markPostWorkoutNudge,
  POST_WORKOUT_AT_KEY,
} from "./post-workout-nudge.ts";

function mockSession() {
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
  Object.defineProperty(globalThis, "sessionStorage", {
    value: storage,
    configurable: true,
  });
  map.clear();
  return map;
}

test("mark/has/clear post-workout nudge", () => {
  mockSession();
  const now = 1_700_000_000_000;
  assert.equal(hasFreshPostWorkoutNudge(now), false);
  markPostWorkoutNudge(now);
  assert.equal(sessionStorage.getItem(POST_WORKOUT_AT_KEY), String(now));
  assert.equal(hasFreshPostWorkoutNudge(now + 60_000), true);
  assert.equal(hasFreshPostWorkoutNudge(now + 7 * 60 * 60 * 1000), false);
  clearPostWorkoutNudge();
  assert.equal(hasFreshPostWorkoutNudge(now), false);
});
