import assert from "node:assert/strict";
import { test } from "node:test";
import {
  WORKOUT_SET_DRAFT_QUEUE_KEY,
  countWorkoutFinishDrafts,
  countWorkoutOfflineDrafts,
  countWorkoutSetDrafts,
  enqueueWorkoutFinishDraft,
  enqueueWorkoutSetDraft,
  listWorkoutFinishDrafts,
  listWorkoutSetDrafts,
  listWorkoutSetDraftsForSession,
  remapWorkoutDraftIds,
  removeWorkoutFinishDraft,
  removeWorkoutSetDraft,
} from "./workout-set-draft-queue.ts";

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

test("enqueueWorkoutSetDraft and removeWorkoutSetDraft", () => {
  mockStorage();
  const id = enqueueWorkoutSetDraft({
    sessionId: "s1",
    exerciseId: "e1",
    body: { reps: 8, weightKg: 60, completed: true },
  });
  assert.equal(countWorkoutSetDrafts(), 1);
  assert.equal(listWorkoutSetDrafts()[0]?.exerciseId, "e1");
  assert.equal(listWorkoutSetDraftsForSession("s1").length, 1);
  assert.equal(listWorkoutSetDraftsForSession("other").length, 0);
  assert.ok(localStorage.getItem(WORKOUT_SET_DRAFT_QUEUE_KEY));
  removeWorkoutSetDraft(id);
  assert.equal(countWorkoutSetDrafts(), 0);
});

test("enqueueWorkoutFinishDraft dedupes per session", () => {
  mockStorage();
  const a = enqueueWorkoutFinishDraft("s1");
  const b = enqueueWorkoutFinishDraft("s1");
  assert.equal(a, b);
  assert.equal(countWorkoutFinishDrafts(), 1);
  assert.equal(listWorkoutFinishDrafts()[0]?.sessionId, "s1");
  enqueueWorkoutSetDraft({
    sessionId: "s1",
    exerciseId: "e1",
    body: { reps: 5, weightKg: 40, completed: true },
  });
  assert.equal(countWorkoutOfflineDrafts(), 2);
  removeWorkoutFinishDraft(a);
  assert.equal(countWorkoutFinishDrafts(), 0);
});

test("remapWorkoutDraftIds rewrites session and exercise ids", () => {
  mockStorage();
  enqueueWorkoutSetDraft({
    sessionId: "local-sess-1",
    exerciseId: "local-ex-1",
    body: { reps: 5, weightKg: 40, completed: true },
  });
  enqueueWorkoutFinishDraft("local-sess-1");
  remapWorkoutDraftIds({
    sessionIdMap: { "local-sess-1": "srv-s" },
    exerciseIdMap: { "local-ex-1": "srv-e" },
  });
  assert.equal(listWorkoutSetDrafts()[0]?.sessionId, "srv-s");
  assert.equal(listWorkoutSetDrafts()[0]?.exerciseId, "srv-e");
  assert.equal(listWorkoutFinishDrafts()[0]?.sessionId, "srv-s");
});
