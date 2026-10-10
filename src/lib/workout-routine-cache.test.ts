import assert from "node:assert/strict";
import { test } from "node:test";
import {
  WORKOUT_ROUTINES_CACHE_KEY,
  getCachedWorkoutRoutine,
  readWorkoutRoutinesCache,
  writeWorkoutRoutinesCache,
} from "./workout-routine-cache.ts";
import type { SerializedRoutine } from "./workouts/routines.ts";

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

const sample: SerializedRoutine = {
  id: "r1",
  name: "Грудь",
  note: null,
  sortOrder: 0,
  weekdays: [0, 2],
  planLabel: "A",
  muscleKeys: ["chest"],
  muscleLabels: ["Грудь"],
  exerciseCount: 1,
  exercises: [
    {
      id: "ex1",
      name: "Жим",
      kind: "strength",
      muscleGroup: "chest",
      sortOrder: 0,
      plannedSets: [{ weightKg: 60, reps: 8, distanceKm: null, durationSec: null, setType: "working" }],
      supersetGroup: null,
      blockMode: "normal",
      circuitRounds: null,
    },
  ],
  updatedAt: "2026-10-10T00:00:00.000Z",
};

test("write/read routine cache", () => {
  mockStorage();
  writeWorkoutRoutinesCache([sample]);
  assert.ok(localStorage.getItem(WORKOUT_ROUTINES_CACHE_KEY));
  assert.equal(readWorkoutRoutinesCache().length, 1);
  assert.equal(getCachedWorkoutRoutine("r1")?.name, "Грудь");
  assert.equal(getCachedWorkoutRoutine("missing"), null);
});
