import assert from "node:assert/strict";
import { test } from "node:test";
import { buildExerciseHistoryByNormName, historyForExerciseName } from "./history.ts";
import { normalizeExerciseName } from "./exercise-name.ts";

test("normalizeExerciseName collapses spaces and case", () => {
  assert.equal(normalizeExerciseName("  Жим  лёжа "), "жим лёжа");
});

test("buildExerciseHistoryByNormName picks latest prior sets per name", () => {
  const byNorm = buildExerciseHistoryByNormName(
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
        date: "2026-09-10",
        createdAt: "2026-09-10T10:00:00Z",
        exercises: [
          {
            id: "e2",
            name: "жим лёжа",
            sets: [{ weightKg: 82.5, reps: 8, sortOrder: 0 }],
          },
        ],
      },
      {
        id: "s3",
        date: "2026-09-12",
        createdAt: "2026-09-12T10:00:00Z",
        exercises: [{ id: "e3", name: "Присед", sets: [{ weightKg: 100, reps: 5, sortOrder: 0 }] }],
      },
    ],
    { excludeSessionId: "s3" },
  );

  const bench = historyForExerciseName(byNorm, "Жим лёжа");
  assert.equal(bench?.date, "2026-09-10");
  assert.deepEqual(bench?.sets, [{ weightKg: 82.5, reps: 8 }]);
  assert.equal(historyForExerciseName(byNorm, "Присед"), null);
});
