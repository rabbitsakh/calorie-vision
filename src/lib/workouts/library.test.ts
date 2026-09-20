import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { normalizeExerciseName } from "@/lib/workouts/exercise-name";
import { parsePlannedSets, plannedSetsToJson } from "@/lib/workouts/routines";

describe("normalizeExerciseName", () => {
  it("collapses spaces and lowercases", () => {
    assert.equal(normalizeExerciseName("  Жим  лёжа "), "жим лёжа");
  });
});

describe("parsePlannedSets", () => {
  it("parses strength and cardio rows", () => {
    const sets = parsePlannedSets([
      { weightKg: 80, reps: 8, setType: "working" },
      { distanceKm: 5, durationSec: 1500, setType: "working" },
      { setType: "warmup" },
      null,
      "x",
    ]);
    assert.equal(sets.length, 3);
    assert.deepEqual(sets[0], {
      weightKg: 80,
      reps: 8,
      distanceKm: null,
      durationSec: null,
      setType: "working",
    });
    assert.equal(sets[1]?.distanceKm, 5);
    assert.equal(sets[1]?.durationSec, 1500);
    assert.equal(sets[2]?.setType, "warmup");
  });

  it("round-trips via JSON", () => {
    const sets = parsePlannedSets([{ weightKg: 60, reps: 10 }]);
    const again = parsePlannedSets(plannedSetsToJson(sets));
    assert.deepEqual(again, sets);
  });
});
