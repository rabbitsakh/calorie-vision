import assert from "node:assert/strict";
import { test } from "node:test";
import {
  WORKOUT_LOCAL_SESSION_KEY,
  addLocalWorkoutExercise,
  createLocalWorkoutSession,
  getLocalWorkoutSession,
  isLocalSessionId,
  listLocalWorkoutSessions,
  localSessionToDetail,
  removeLocalWorkoutSession,
} from "./workout-local-session.ts";

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

test("create local session + exercise + detail", () => {
  mockStorage();
  const s = createLocalWorkoutSession({
    date: "2026-10-10",
    muscleKeys: ["chest", "triceps"],
  });
  assert.ok(isLocalSessionId(s.id));
  assert.equal(listLocalWorkoutSessions().length, 1);
  const next = addLocalWorkoutExercise(s.id, { name: "Жим", kind: "strength" });
  assert.equal(next?.exercises.length, 1);
  assert.ok(next!.exercises[0]!.id.startsWith("local-ex-"));
  const detail = localSessionToDetail(getLocalWorkoutSession(s.id)!);
  assert.equal(detail.exercises[0]!.name, "Жим");
  assert.ok(localStorage.getItem(WORKOUT_LOCAL_SESSION_KEY));
  removeLocalWorkoutSession(s.id);
  assert.equal(listLocalWorkoutSessions().length, 0);
});
