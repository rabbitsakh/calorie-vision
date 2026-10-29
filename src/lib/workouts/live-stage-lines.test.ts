import assert from "node:assert/strict";
import { test } from "node:test";
import { exerciseDoneShare, nextExerciseLine } from "./live-stage-lines.ts";

const set = (completed: boolean, reps: number | null = 8) => ({ completed, reps });

test("exerciseDoneShare: fraction of completed sets", () => {
  assert.equal(exerciseDoneShare({ sets: [] }), 0);
  assert.equal(exerciseDoneShare({ sets: [set(true), set(false)] }), 0.5);
});

test("nextExerciseLine: next exercise with sets × reps", () => {
  const ex = [
    { id: "a", name: "Жим лёжа", sets: [set(true)] },
    { id: "b", name: "Брусья", sets: [set(false, 10), set(false, 10), set(false, 10)] },
  ];
  assert.equal(nextExerciseLine(ex, "a"), "Далее: Брусья · 3 × 10");
  assert.equal(nextExerciseLine(ex, "b"), null);
});

test("nextExerciseLine: skips the rest of the superset group", () => {
  const ex = [
    { id: "a", name: "Тяга", supersetGroup: "A", sets: [set(false)] },
    { id: "b", name: "Отжимания", supersetGroup: "A", sets: [set(false)] },
    { id: "c", name: "Планка", sets: [] },
  ];
  assert.equal(nextExerciseLine(ex, "a"), "Далее: Планка");
});
