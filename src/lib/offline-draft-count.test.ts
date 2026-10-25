import assert from "node:assert/strict";
import { test } from "node:test";
import { countAllOfflineDrafts } from "./offline-draft-count.ts";
import { enqueueFailedSave, MEAL_DRAFT_QUEUE_KEY } from "./meal-draft-queue.ts";
import { enqueueWaterDraft, WATER_DRAFT_QUEUE_KEY } from "./water-draft-queue.ts";
import {
  markShoppingSyncDirty,
  SHOPPING_SYNC_DIRTY_KEY,
} from "./shopping-sync-draft.ts";
import {
  ASSISTANT_APPLY_QUEUE_KEY,
  enqueueAssistantApply,
} from "./assistant-apply-queue.ts";
import {
  enqueueRewardsDraft,
  REWARDS_DRAFT_QUEUE_KEY,
} from "./rewards-draft-queue.ts";

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
  enqueueAssistantApply("meals", {
    kind: "meals",
    date: "2026-08-24",
    actions: { meals: [{ name: "Суп" }] },
  });
  assert.equal(countAllOfflineDrafts(), 4);
  enqueueRewardsDraft({ source: "quest", action: "mark", date: "2026-08-24" });
  assert.equal(countAllOfflineDrafts(), 5);
  assert.ok(localStorage.getItem(MEAL_DRAFT_QUEUE_KEY));
  assert.ok(localStorage.getItem(WATER_DRAFT_QUEUE_KEY));
  assert.ok(localStorage.getItem(SHOPPING_SYNC_DIRTY_KEY));
  assert.ok(localStorage.getItem(ASSISTANT_APPLY_QUEUE_KEY));
  assert.ok(localStorage.getItem(REWARDS_DRAFT_QUEUE_KEY));
});
