import assert from "node:assert/strict";
import { test } from "node:test";
import {
  OFFLINE_SESSION_CACHE_KEY,
  clearOfflineSessionCache,
  hasOfflineSessionCache,
  readOfflineSessionCache,
  writeOfflineSessionCache,
} from "./offline-session.ts";

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
  return map;
}

test("write/read/clear offline session cache", () => {
  mockStorage();
  assert.equal(hasOfflineSessionCache(), false);
  writeOfflineSessionCache({
    user: { id: "u1", name: "Анна", email: "a@ex.com", image: null },
    expires: "2099-01-01T00:00:00.000Z",
  });
  assert.equal(hasOfflineSessionCache(), true);
  const hit = readOfflineSessionCache();
  assert.equal(hit?.user.name, "Анна");
  assert.equal(hit?.user.id, "u1");
  assert.ok(localStorage.getItem(OFFLINE_SESSION_CACHE_KEY));
  clearOfflineSessionCache();
  assert.equal(hasOfflineSessionCache(), false);
});

test("writeOfflineSessionCache ignores empty user", () => {
  mockStorage();
  writeOfflineSessionCache(null);
  writeOfflineSessionCache({ user: null });
  assert.equal(hasOfflineSessionCache(), false);
});
