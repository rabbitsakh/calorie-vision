import assert from "node:assert/strict";
import { test } from "node:test";
import { buildWorkoutPdf } from "./export-pdf.ts";
import type { WorkoutExportSession } from "./export-csv.ts";

const session: WorkoutExportSession = {
  date: "2026-08-18",
  note: "Жим",
  startedAt: "2026-08-18T18:30:00.000Z",
  endedAt: "2026-08-18T19:15:00.000Z",
  muscles: ["chest"],
  exercises: [
    {
      name: "Жим лёжа",
      kind: "strength",
      note: null,
      sortOrder: 0,
      sets: [
        {
          weightKg: 80,
          reps: 8,
          distanceKm: null,
          durationSec: null,
          setType: "working",
          completed: true,
          rpe: 8,
          sortOrder: 0,
        },
      ],
    },
  ],
};

test("buildWorkoutPdf returns a PDF document", async () => {
  const buffer = await buildWorkoutPdf({
    sessions: [session],
    timezone: "Europe/Moscow",
    from: "2026-08-01",
    to: "2026-08-18",
  });
  assert.ok(buffer.length > 500);
  assert.equal(buffer.subarray(0, 5).toString("utf8"), "%PDF-");
});

test("buildWorkoutPdf still renders an empty period", async () => {
  const buffer = await buildWorkoutPdf({
    sessions: [],
    timezone: "Europe/Moscow",
    from: null,
    to: null,
  });
  assert.equal(buffer.subarray(0, 5).toString("utf8"), "%PDF-");
});
