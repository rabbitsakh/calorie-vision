import assert from "node:assert/strict";
import { test } from "node:test";
import { ACCOUNT_DELETE_CONFIRM } from "./account-delete-confirm.ts";
import {
  METRIKA_GOALS,
  getMetrikaClientId,
  setMetrikaClientId,
  trackMetrikaGoal,
} from "./yandex-metrika.ts";
import {
  resetMetrikaFunnelStorageForTests,
  trackD7ReturnGoal,
  trackFirstMealSaveGoal,
  trackLoginGoal,
} from "./metrika-funnel.ts";

test("account delete confirm token is DELETE", () => {
  assert.equal(ACCOUNT_DELETE_CONFIRM, "DELETE");
});

test("setMetrikaClientId enables goal tracking", () => {
  const calls: unknown[][] = [];
  const previous = (globalThis as { window?: unknown }).window;
  (globalThis as { window: { ym: (...args: unknown[]) => void; localStorage: Storage; sessionStorage: Storage } }).window =
    {
      ym: (...args: unknown[]) => {
        calls.push(args);
      },
      localStorage: memoryStorage(),
      sessionStorage: memoryStorage(),
    };

  setMetrikaClientId("111847071");
  assert.equal(getMetrikaClientId(), "111847071");
  trackMetrikaGoal(METRIKA_GOALS.login);
  assert.deepEqual(calls[0], [111847071, "reachGoal", "login"]);

  (globalThis as { window?: unknown }).window = previous;
  setMetrikaClientId(null);
});

test("funnel goals fire once for first meal and d7", () => {
  const calls: string[] = [];
  const previous = (globalThis as { window?: unknown }).window;
  const local = memoryStorage();
  const session = memoryStorage();
  (globalThis as {
    window: {
      ym: (id: number, method: string, goal: string) => void;
      localStorage: Storage;
      sessionStorage: Storage;
    };
  }).window = {
    ym: (_id, method, goal) => {
      if (method === "reachGoal") calls.push(goal);
    },
    localStorage: local,
    sessionStorage: session,
  };
  setMetrikaClientId("111847071");
  resetMetrikaFunnelStorageForTests();

  trackLoginGoal();
  trackLoginGoal();
  trackFirstMealSaveGoal();
  trackFirstMealSaveGoal();
  trackD7ReturnGoal(1_000);
  trackD7ReturnGoal(1_000 + 8 * 24 * 60 * 60 * 1000);

  assert.deepEqual(calls, ["login", "first_meal_save", "d7_return"]);

  (globalThis as { window?: unknown }).window = previous;
  setMetrikaClientId(null);
});

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
