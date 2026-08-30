import assert from "node:assert/strict";
import { test } from "node:test";
import {
  getEquippedFrameKey,
  resetEquippedFrameForTests,
  setEquippedFrameKey,
} from "./equipped-frame.ts";

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
      map.set(key, value);
    },
  };
}

test("equipped frame persists in localStorage", () => {
  const previous = (globalThis as { window?: unknown }).window;
  (globalThis as { window: { localStorage: Storage; dispatchEvent: () => boolean } }).window = {
    localStorage: memoryStorage(),
    dispatchEvent: () => true,
  };

  resetEquippedFrameForTests();
  assert.equal(getEquippedFrameKey(), null);
  setEquippedFrameKey("frame_teal");
  assert.equal(getEquippedFrameKey(), "frame_teal");
  setEquippedFrameKey(null);
  assert.equal(getEquippedFrameKey(), null);

  (globalThis as { window?: unknown }).window = previous;
});
