import assert from "node:assert/strict";
import { test } from "node:test";
import {
  ASSISTANT_APPLY_QUEUE_KEY,
  clearAssistantApplyQueue,
  countAssistantApplyQueue,
  enqueueAssistantApply,
  listAssistantApplyQueue,
  removeAssistantApply,
} from "./assistant-apply-queue.ts";

// Minimal localStorage shim for node:test
const store = new Map<string, string>();
(globalThis as { localStorage?: Storage }).localStorage = {
  getItem: (k) => store.get(k) ?? null,
  setItem: (k, v) => {
    store.set(k, String(v));
  },
  removeItem: (k) => {
    store.delete(k);
  },
  clear: () => store.clear(),
  key: () => null,
  get length() {
    return store.size;
  },
} as Storage;

test("enqueue / count / remove assistant apply queue", () => {
  store.clear();
  clearAssistantApplyQueue();
  const id = enqueueAssistantApply("photo", {
    date: "2026-10-13",
    imagePath: "/x.jpg",
    drafts: [{ dishName: "Суп", calories: 100 }],
  });
  assert.equal(countAssistantApplyQueue(), 1);
  assert.equal(listAssistantApplyQueue()[0]?.kind, "photo");
  assert.equal(listAssistantApplyQueue()[0]?.body.kind, "photo");
  removeAssistantApply(id);
  assert.equal(countAssistantApplyQueue(), 0);
  assert.ok(ASSISTANT_APPLY_QUEUE_KEY.length > 0);
});

test("Assistant K: shopping and start kinds enqueue", () => {
  store.clear();
  clearAssistantApplyQueue();
  enqueueAssistantApply("shopping", {
    kind: "shopping",
    date: "2026-10-14",
    actions: { shopping: ["Хлеб"] },
  });
  enqueueAssistantApply("start", {
    kind: "start",
    date: "2026-10-14",
    actions: { startWorkout: true },
  });
  assert.equal(countAssistantApplyQueue(), 2);
  const kinds = listAssistantApplyQueue().map((x) => x.kind).sort();
  assert.deepEqual(kinds, ["shopping", "start"]);
});

test("Assistant L: water kind enqueues", () => {
  store.clear();
  clearAssistantApplyQueue();
  enqueueAssistantApply("water", {
    kind: "water",
    date: "2026-10-16",
    actions: { waterMl: 250 },
  });
  assert.equal(countAssistantApplyQueue(), 1);
  assert.equal(listAssistantApplyQueue()[0]?.kind, "water");
});

test("Assistant M: weight kind enqueues", () => {
  store.clear();
  clearAssistantApplyQueue();
  enqueueAssistantApply("weight", {
    kind: "weight",
    date: "2026-10-17",
    actions: { weightKg: 72.5 },
  });
  assert.equal(countAssistantApplyQueue(), 1);
  assert.equal(listAssistantApplyQueue()[0]?.kind, "weight");
});

test("Assistant N: deleteMeals and patchMeals kinds enqueue", () => {
  store.clear();
  clearAssistantApplyQueue();
  enqueueAssistantApply("deleteMeals", {
    kind: "deleteMeals",
    date: "2026-10-17",
    actions: { deleteMeals: [{ match: "Омлет" }] },
  });
  enqueueAssistantApply("patchMeals", {
    kind: "patchMeals",
    date: "2026-10-17",
    actions: { patchMeals: [{ match: "суп", kcal: 220 }] },
  });
  assert.equal(countAssistantApplyQueue(), 2);
  const kinds = listAssistantApplyQueue().map((x) => x.kind).sort();
  assert.deepEqual(kinds, ["deleteMeals", "patchMeals"]);
});
