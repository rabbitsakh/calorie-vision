import assert from "node:assert/strict";
import test from "node:test";
import {
  exerciseDraftMapped,
  localSessionExercisesFullyMapped,
} from "@/lib/workout-flush-guards";

test("localSessionExercisesFullyMapped", () => {
  assert.equal(localSessionExercisesFullyMapped([], {}), true);
  assert.equal(localSessionExercisesFullyMapped(["a"], { a: "s1" }), true);
  assert.equal(localSessionExercisesFullyMapped(["a", "b"], { a: "s1" }), false);
});

test("exerciseDraftMapped", () => {
  assert.equal(exerciseDraftMapped("local-ex-1", "srv-1"), true);
  assert.equal(exerciseDraftMapped("local-ex-1", null), false);
  assert.equal(exerciseDraftMapped("local-ex-1", "local-ex-1"), false);
});
