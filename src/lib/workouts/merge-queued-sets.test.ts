import assert from "node:assert/strict";
import { test } from "node:test";
import {
  draftBodyToPendingSet,
  draftIdFromLocalSetId,
  localDraftSetId,
  mergeQueuedSetsIntoSession,
} from "./merge-queued-sets.ts";
import type { WorkoutSetDraftItem } from "../workout-set-draft-queue.ts";

test("draftBodyToPendingSet maps weight×reps and load", () => {
  const row = draftBodyToPendingSet("d1", {
    weightKg: 80,
    reps: 5,
    setType: "working",
    completed: true,
  });
  assert.equal(row.id, "local-d1");
  assert.equal(row.load, 400);
  assert.equal(row.pendingLocal, true);
  assert.equal(draftIdFromLocalSetId(row.id), "d1");
  assert.equal(localDraftSetId("x"), "local-x");
});

test("mergeQueuedSetsIntoSession appends and bumps tonnage", () => {
  const session = {
    id: "s1",
    totalLoad: 400,
    setCount: 1,
    cardioDistanceKm: 0,
    cardioDurationSec: 0,
    exercises: [
      {
        id: "e1",
        kind: "barbell",
        load: 400,
        cardioDistanceKm: 0,
        cardioDurationSec: 0,
        sets: [
          {
            id: "server-1",
            weightKg: 80,
            reps: 5,
            distanceKm: null,
            durationSec: null,
            setType: "working" as const,
            completed: true,
            rpe: null,
            paceSecPerKm: null,
            load: 400,
          },
        ],
      },
    ],
  };
  const drafts: WorkoutSetDraftItem[] = [
    {
      id: "d1",
      kind: "failed-workout-set",
      createdAt: "2026-10-09T00:00:00.000Z",
      sessionId: "s1",
      exerciseId: "e1",
      body: { weightKg: 82.5, reps: 5, setType: "working", completed: true },
    },
  ];
  const merged = mergeQueuedSetsIntoSession(session, drafts);
  assert.equal(merged.exercises[0]!.sets.length, 2);
  assert.equal(merged.exercises[0]!.sets[1]!.pendingLocal, true);
  assert.equal(merged.totalLoad, 400 + 82.5 * 5);
  assert.equal(merged.setCount, 2);
});

test("merge ignores drafts for other sessions", () => {
  const session = {
    id: "s1",
    totalLoad: 0,
    setCount: 0,
    cardioDistanceKm: 0,
    cardioDurationSec: 0,
    exercises: [
      {
        id: "e1",
        kind: "barbell",
        load: 0,
        cardioDistanceKm: 0,
        cardioDurationSec: 0,
        sets: [],
      },
    ],
  };
  const merged = mergeQueuedSetsIntoSession(session, [
    {
      id: "d1",
      kind: "failed-workout-set",
      createdAt: "t",
      sessionId: "other",
      exerciseId: "e1",
      body: { weightKg: 60, reps: 8, completed: true },
    },
  ]);
  assert.equal(merged.exercises[0]!.sets.length, 0);
});
