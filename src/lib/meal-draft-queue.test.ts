import assert from "node:assert/strict";
import { test } from "node:test";
import {
  clearPendingConfirmDraft,
  countFailedSaves,
  countOfflineQueue,
  countPendingRecognitions,
  enqueueFailedSave,
  getPendingConfirmDraft,
  listFailedSaves,
  listMealDrafts,
  listPendingRecognitions,
  MEAL_DRAFT_QUEUE_KEY,
  removeMealDraft,
  subscribeMealDraftQueue,
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

test("pending-recognition metadata round-trip without IndexedDB", () => {
  mockStorage();
  const items = listMealDrafts();
  items.push({
    id: "photo-1",
    kind: "pending-recognition",
    createdAt: "2026-08-24T10:00:00.000Z",
    selectedDate: "2026-08-24",
    fileName: "lunch.jpg",
    mimeType: "image/jpeg",
    restaurantMode: true,
  });
  localStorage.setItem(MEAL_DRAFT_QUEUE_KEY, JSON.stringify(items));
  assert.equal(countPendingRecognitions(), 1);
  assert.equal(listPendingRecognitions()[0]?.fileName, "lunch.jpg");
  assert.equal(countOfflineQueue(), 1);
  removeMealDraft("photo-1");
  assert.equal(countPendingRecognitions(), 0);
});

test("subscribeMealDraftQueue fires on queue writes", () => {
  mockStorage();
  let calls = 0;
  const unsub = subscribeMealDraftQueue(() => {
    calls += 1;
  });
  enqueueFailedSave("2026-08-24", {
    date: "2026-08-24",
    dishName: "Каша",
    calories: 300,
  });
  assert.equal(calls, 1);
  unsub();
});
