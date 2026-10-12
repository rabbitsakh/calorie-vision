import assert from "node:assert/strict";
import { test } from "node:test";
import {
  clearShoppingSyncDirty,
  countShoppingSyncDrafts,
  isShoppingSyncDirty,
  markShoppingSyncDirty,
  SHOPPING_SYNC_DIRTY_KEY,
  subscribeShoppingSyncDraft,
} from "./shopping-sync-draft.ts";

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
  Object.defineProperty(globalThis, "window", {
    value: { localStorage: storage },
    configurable: true,
  });
  Object.defineProperty(globalThis, "localStorage", {
    value: storage,
    configurable: true,
  });
  map.clear();
  return map;
}

test("shopping sync dirty counts as one draft and notifies", () => {
  const map = mockStorage();
  let ticks = 0;
  const unsub = subscribeShoppingSyncDraft(() => {
    ticks += 1;
  });
  assert.equal(countShoppingSyncDrafts(), 0);
  markShoppingSyncDirty();
  assert.equal(isShoppingSyncDirty(), true);
  assert.equal(countShoppingSyncDrafts(), 1);
  assert.equal(map.get(SHOPPING_SYNC_DIRTY_KEY), "1");
  assert.equal(ticks, 1);
  clearShoppingSyncDirty();
  assert.equal(countShoppingSyncDrafts(), 0);
  assert.equal(ticks, 2);
  unsub();
});
