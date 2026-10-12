import assert from "node:assert/strict";
import { test } from "node:test";
import { countAllOfflineDrafts } from "./offline-draft-count.ts";
import { enqueueFailedSave, MEAL_DRAFT_QUEUE_KEY } from "./meal-draft-queue.ts";
import { enqueueWaterDraft, WATER_DRAFT_QUEUE_KEY } from "./water-draft-queue.ts";
import {
  markShoppingSyncDirty,
  SHOPPING_SYNC_DIRTY_KEY,
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
    value: {
      localStorage: storage,
      dispatchEvent() {
        return true;
      },
      addEventListener() {},
      removeEventListener() {},
    },
    configurable: true,
  });
  Object.defineProperty(globalThis, "localStorage", { value: storage, configurable: true });
  map.clear();
  return map;
}

test("countAllOfflineDrafts sums meal, water, and shopping sync drafts", () => {
  mockStorage();
  assert.equal(countAllOfflineDrafts(), 0);
  enqueueFailedSave("2026-08-24", { date: "2026-08-24", dishName: "Каша", calories: 300 });
  enqueueWaterDraft("2026-08-24", 250);
  assert.equal(countAllOfflineDrafts(), 2);
  markShoppingSyncDirty();
  assert.equal(countAllOfflineDrafts(), 3);
  assert.ok(localStorage.getItem(MEAL_DRAFT_QUEUE_KEY));
  assert.ok(localStorage.getItem(WATER_DRAFT_QUEUE_KEY));
  assert.ok(localStorage.getItem(SHOPPING_SYNC_DIRTY_KEY));
});
