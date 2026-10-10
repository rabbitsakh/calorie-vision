import assert from "node:assert/strict";
import { test } from "node:test";
import {
  WORKOUT_EXERCISE_DRAFT_QUEUE_KEY,
  countWorkoutExerciseDrafts,
  enqueueWorkoutExerciseDraft,
  listWorkoutExerciseDraftsForSession,
  remapWorkoutExerciseDraftSessionIds,
  removeWorkoutExerciseDraft,
} from "./workout-exercise-draft-queue.ts";

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
}

test("enqueue exercise draft with local-ex id", () => {
  mockStorage();
  const id = enqueueWorkoutExerciseDraft({
    sessionId: "srv-s",
    name: "Жим лёжа",
    exerciseKind: "strength",
  });
  assert.ok(id.startsWith("local-ex-"));
  assert.equal(countWorkoutExerciseDrafts(), 1);
  assert.equal(listWorkoutExerciseDraftsForSession("srv-s")[0]?.name, "Жим лёжа");
  assert.ok(localStorage.getItem(WORKOUT_EXERCISE_DRAFT_QUEUE_KEY));
  removeWorkoutExerciseDraft(id);
  assert.equal(countWorkoutExerciseDrafts(), 0);
});

test("remapWorkoutExerciseDraftSessionIds", () => {
  mockStorage();
  enqueueWorkoutExerciseDraft({
    sessionId: "local-sess-1",
    name: "Присед",
    exerciseKind: "strength",
  });
  remapWorkoutExerciseDraftSessionIds({ "local-sess-1": "srv-s" });
  assert.equal(listWorkoutExerciseDraftsForSession("srv-s").length, 1);
  assert.equal(listWorkoutExerciseDraftsForSession("local-sess-1").length, 0);
});
