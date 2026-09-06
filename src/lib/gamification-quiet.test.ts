import assert from "node:assert/strict";
import { describe, test } from "node:test";
import {
  GAMIFICATION_QUIET_KEY,
  QUIET_DEFAULT_APPLIED_KEY,
  ensureQuietDefaultForNewUsers,
  isGamificationQuiet,
  setGamificationQuiet,
} from "./gamification-quiet";

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

describe("gamification-quiet", () => {
  test("defaults off and toggles via localStorage", () => {
    const storage = memoryStorage();
    (globalThis as { localStorage?: Storage }).localStorage = storage;

    assert.equal(isGamificationQuiet(), false);
    setGamificationQuiet(true);
    assert.equal(storage.getItem(GAMIFICATION_QUIET_KEY), "1");
    assert.equal(isGamificationQuiet(), true);
    setGamificationQuiet(false);
    assert.equal(storage.getItem(GAMIFICATION_QUIET_KEY), null);
    assert.equal(isGamificationQuiet(), false);

    delete (globalThis as { localStorage?: Storage }).localStorage;
  });
  test("ensureQuietDefaultForNewUsers sets quiet once for unset preference", () => {
    const storage = memoryStorage();
    (globalThis as { localStorage?: Storage }).localStorage = storage;

    ensureQuietDefaultForNewUsers();
    assert.equal(storage.getItem(GAMIFICATION_QUIET_KEY), "1");
    assert.equal(storage.getItem(QUIET_DEFAULT_APPLIED_KEY), "1");
    assert.equal(isGamificationQuiet(), true);

    setGamificationQuiet(false);
    ensureQuietDefaultForNewUsers();
    assert.equal(isGamificationQuiet(), false);

    delete (globalThis as { localStorage?: Storage }).localStorage;
  });

});
