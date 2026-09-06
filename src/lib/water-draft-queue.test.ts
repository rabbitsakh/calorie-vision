import assert from "node:assert/strict";
import { test } from "node:test";
import {
  WATER_DRAFT_QUEUE_KEY,
  countWaterDrafts,
  enqueueWaterDraft,
  listWaterDrafts,
  removeWaterDraft,
} from "./water-draft-queue.ts";

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

test("enqueueWaterDraft and removeWaterDraft", () => {
  mockStorage();
  const id = enqueueWaterDraft("2026-09-06", 250);
  assert.equal(countWaterDrafts(), 1);
  assert.equal(listWaterDrafts()[0]?.ml, 250);
  assert.ok(localStorage.getItem(WATER_DRAFT_QUEUE_KEY));
  removeWaterDraft(id);
  assert.equal(countWaterDrafts(), 0);
});
