import assert from "node:assert/strict";
import test from "node:test";
import {
  celebrationCapDateKey,
  consumeFullscreenCelebrationSlot,
  FS_CELEB_DAILY_CAP,
  getFullscreenCelebrationCount,
  isFullscreenCelebrationCapReached,
} from "@/lib/celebration-daily-cap";

test("fullscreen celebration daily cap is 2", () => {
  const memory = new Map<string, string>();
  const storage: Storage = {
    get length() {
      return memory.size;
    },
    clear: () => memory.clear(),
    getItem: (key) => memory.get(key) ?? null,
    setItem: (key, value) => {
      memory.set(key, String(value));
    },
    removeItem: (key) => {
      memory.delete(key);
    },
    key: () => null,
  };

  (globalThis as { window?: { localStorage: Storage } }).window = { localStorage: storage };

  const date = celebrationCapDateKey(new Date("2026-08-24T12:00:00"));
  assert.equal(getFullscreenCelebrationCount(date), 0);
  assert.equal(isFullscreenCelebrationCapReached(date), false);

  assert.equal(consumeFullscreenCelebrationSlot(date), true);
  assert.equal(consumeFullscreenCelebrationSlot(date), true);
  assert.equal(getFullscreenCelebrationCount(date), FS_CELEB_DAILY_CAP);
  assert.equal(consumeFullscreenCelebrationSlot(date), false);
  assert.equal(isFullscreenCelebrationCapReached(date), true);
});
