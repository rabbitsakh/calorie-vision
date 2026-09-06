import assert from "node:assert/strict";
import { test } from "node:test";
import {
  WEIGHT_DRAFT_QUEUE_KEY,
  countWeightDrafts,
  enqueueWeightDraft,
  listWeightDrafts,
  removeWeightDraft,
} from "./weight-draft-queue.ts";

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

test("enqueueWeightDraft and removeWeightDraft", () => {
  mockStorage();
  const id = enqueueWeightDraft({
    date: "2026-09-06",
    weightKg: 72.5,
    measuredAt: "2026-09-06T08:00:00.000Z",
    note: null,
  });
  assert.equal(countWeightDrafts(), 1);
  assert.equal(listWeightDrafts()[0]?.weightKg, 72.5);
  assert.ok(localStorage.getItem(WEIGHT_DRAFT_QUEUE_KEY));
  removeWeightDraft(id);
  assert.equal(countWeightDrafts(), 0);
});
