import assert from "node:assert/strict";
import { test } from "node:test";
import {
  formatSuggestedKg,
  pickLastWorkingWeight,
  pickTopWorkingSet,
  pickTopWorkingWeight,
  suggestNextWeightKg,
} from "./suggested-load.ts";

test("suggestNextWeightKg adds progress and rounds to 0.5", () => {
  assert.equal(suggestNextWeightKg(80, 0.05), 84);
  assert.equal(suggestNextWeightKg(20, 0.05), 21);
  assert.equal(suggestNextWeightKg(82.5, 0.025), 84.5);
  assert.equal(suggestNextWeightKg(null), null);
});

test("pickTopWorkingWeight skips warmup and drop — uses max working", () => {
  assert.equal(
    pickTopWorkingWeight([
      { weightKg: 60, setType: "warmup", completed: true },
      { weightKg: 80, setType: "working", completed: true },
      { weightKg: 82.5, setType: "working", completed: true },
      { weightKg: 52.5, setType: "drop", completed: true },
    ]),
    82.5,
  );
  assert.equal(
    pickLastWorkingWeight([
      { weightKg: 70, setType: "working", completed: true },
      { weightKg: 40, setType: "drop", completed: true },
    ]),
    70,
  );
  assert.equal(pickTopWorkingWeight([{ weightKg: 20, setType: "working" }]), 20);
  assert.equal(pickTopWorkingWeight([]), null);
});

test("pickTopWorkingSet keeps best reps at top kg", () => {
  const top = pickTopWorkingSet([
    { weightKg: 70, reps: 8, setType: "working", completed: true },
    { weightKg: 70, reps: 6, setType: "working", completed: true },
    { weightKg: 52.5, reps: 12, setType: "drop", completed: true },
  ]);
  assert.equal(top?.weightKg, 70);
  assert.equal(top?.reps, 8);
});

test("formatSuggestedKg", () => {
  assert.equal(formatSuggestedKg(84), "84");
  assert.equal(formatSuggestedKg(84.5), "84.5");
});
