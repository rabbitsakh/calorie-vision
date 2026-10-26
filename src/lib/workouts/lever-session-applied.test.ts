import assert from "node:assert/strict";
import { test } from "node:test";
import {
  hasLeverAppliedForSession,
  LEVER_SESSION_APPLIED_KEY,
  markLeverAppliedForSession,
  resetLeverSessionAppliedForTests,
} from "./lever-session-applied.ts";

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
  map.delete(LEVER_SESSION_APPLIED_KEY);
  resetLeverSessionAppliedForTests();
}

test("hasLeverAppliedForSession false until marked", () => {
  installStorage();
  assert.equal(hasLeverAppliedForSession("s1"), false);
  markLeverAppliedForSession("s1");
  assert.equal(hasLeverAppliedForSession("s1"), true);
  assert.equal(hasLeverAppliedForSession("s2"), false);
});

test("markLeverAppliedForSession is idempotent", () => {
  installStorage();
  markLeverAppliedForSession("s1");
  markLeverAppliedForSession("s1");
  const raw = localStorage.getItem(LEVER_SESSION_APPLIED_KEY);
  assert.ok(raw);
  const parsed = JSON.parse(raw!) as { ids: string[] };
  assert.deepEqual(parsed.ids, ["s1"]);
});

test("survives remount — second read still claims session", () => {
  installStorage();
  markLeverAppliedForSession("workout-abc");
  // Simulate remount: new call path only reads storage (no in-memory Set).
  assert.equal(hasLeverAppliedForSession("workout-abc"), true);
});

test("empty session id is ignored", () => {
  installStorage();
  markLeverAppliedForSession("");
  assert.equal(hasLeverAppliedForSession(""), false);
});
