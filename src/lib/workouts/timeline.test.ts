import assert from "node:assert/strict";
import { test } from "node:test";
import { buildExerciseTimeline, topWeightDeltaKg } from "./timeline.ts";

test("buildExerciseTimeline tracks top weight over sessions", () => {
  const points = buildExerciseTimeline(
    [
      {
        id: "s1",
        date: "2026-09-01",
        createdAt: "2026-09-01T10:00:00Z",
        exercises: [
          {
            id: "e1",
            name: "Жим лёжа",
            sets: [
              { weightKg: 80, reps: 8, sortOrder: 0 },
              { weightKg: 80, reps: 6, sortOrder: 1 },
            ],
          },
        ],
      },
      {
        id: "s2",
        date: "2026-09-08",
        createdAt: "2026-09-08T10:00:00Z",
        exercises: [
          {
            id: "e2",
            name: "жим лёжа",
            sets: [
              { weightKg: 82.5, reps: 8, sortOrder: 0 },
              { weightKg: 80, reps: 8, sortOrder: 1 },
            ],
          },
        ],
      },
    ],
    "Жим лёжа",
  );

  assert.equal(points.length, 2);
  assert.equal(points[0]?.topWeightKg, 80);
  assert.equal(points[1]?.topWeightKg, 82.5);
  assert.equal(topWeightDeltaKg(points), 2.5);
});
