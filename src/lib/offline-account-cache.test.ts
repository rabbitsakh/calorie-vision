import assert from "node:assert/strict";
import { test } from "node:test";
import {
  clearOfflineAccountCache,
  readOfflineAccountCache,
  writeOfflineAccountCache,
} from "./offline-account-cache.ts";

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
  Object.defineProperty(globalThis, "window", { value: globalThis, configurable: true });
  Object.defineProperty(globalThis, "localStorage", { value: storage, configurable: true });
  map.clear();
}

test("account cache strips error and round-trips", () => {
  mockStorage();
  writeOfflineAccountCache({
    firstName: "Анна",
    lastName: "П",
    email: "a@ex.com",
    error: "should not persist",
  });
  const hit = readOfflineAccountCache<{ firstName: string; error?: string }>();
  assert.equal(hit?.firstName, "Анна");
  assert.equal(hit?.error, undefined);
  clearOfflineAccountCache();
  assert.equal(readOfflineAccountCache(), null);
});
