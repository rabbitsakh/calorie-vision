import assert from "node:assert/strict";
import { test } from "node:test";
import {
  clearPendingConfirmDraft,
  countFailedSaves,
  enqueueFailedSave,
  getPendingConfirmDraft,
  listFailedSaves,
  listMealDrafts,
  MEAL_DRAFT_QUEUE_KEY,
  removeMealDraft,
  upsertPendingConfirmDraft,
} from "./meal-draft-queue.ts";

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

test("upsertPendingConfirmDraft stores and replaces same date", () => {
  mockStorage();
  upsertPendingConfirmDraft("2026-08-24", {
    imagePath: "/a.jpg",
    recognition: { dishName: "Суп", calories: 200 } as never,
  });
  upsertPendingConfirmDraft("2026-08-24", {
    imagePath: "/b.jpg",
    recognition: { dishName: "Салат", calories: 150 } as never,
  });
  const draft = getPendingConfirmDraft("2026-08-24");
  assert.equal(draft?.result.imagePath, "/b.jpg");
  assert.equal(listMealDrafts().length, 1);
  clearPendingConfirmDraft("2026-08-24");
  assert.equal(getPendingConfirmDraft("2026-08-24"), null);
});

test("enqueueFailedSave and removeMealDraft", () => {
  mockStorage();
  const id = enqueueFailedSave("2026-08-24", {
    date: "2026-08-24",
    dishName: "Каша",
    calories: 300,
  });
  assert.equal(countFailedSaves(), 1);
  assert.equal(listFailedSaves()[0]?.id, id);
  removeMealDraft(id);
  assert.equal(countFailedSaves(), 0);
  assert.equal(localStorage.getItem(MEAL_DRAFT_QUEUE_KEY), null);
});
