import assert from "node:assert/strict";
import { test } from "node:test";
import { listLocalWorkoutSessions } from "../workout-local-session.ts";
import { listWorkoutSetDrafts } from "../workout-set-draft-queue.ts";
import { startRoutineOffline } from "./start-routine-offline.ts";
import type { SerializedRoutine } from "./routines.ts";

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

const routine: SerializedRoutine = {
  id: "r1",
  name: "Ноги",
  note: "Квадры",
  sortOrder: 0,
  weekdays: [1],
  planLabel: null,
  muscleKeys: ["legs"],
  muscleLabels: ["Ноги"],
  exerciseCount: 1,
  exercises: [
    {
      id: "ex1",
      name: "Присед",
      kind: "strength",
      muscleGroup: "legs",
      sortOrder: 0,
      plannedSets: [
        { weightKg: 100, reps: 5, distanceKm: null, durationSec: null, setType: "working" },
        { weightKg: 100, reps: 5, distanceKm: null, durationSec: null, setType: "working" },
      ],
      supersetGroup: null,
      blockMode: "normal",
      circuitRounds: null,
    },
  ],
  updatedAt: "2026-10-10T00:00:00.000Z",
};

test("startRoutineOffline creates local session + planned set drafts", () => {
  mockStorage();
  const result = startRoutineOffline({ routine, date: "2026-10-10" });
  assert.ok(result?.sessionId.startsWith("local-sess-"));
  const local = listLocalWorkoutSessions()[0];
  assert.equal(local?.exercises.length, 1);
  assert.equal(local?.exercises[0]?.name, "Присед");
  const drafts = listWorkoutSetDrafts();
  assert.equal(drafts.length, 2);
  assert.equal(drafts[0]?.body.completed, false);
  assert.equal(drafts[0]?.body.weightKg, 100);
});

test("rejects empty muscles", () => {
  mockStorage();
  assert.equal(
    startRoutineOffline({
      routine: { ...routine, muscleKeys: [] },
      date: "2026-10-10",
    }),
    null,
  );
});
