import assert from "node:assert/strict";
import { test } from "node:test";
import {
  formatSuggestedKg,
  pickLastWorkingWeight,
  suggestNextWeightKg,
} from "./suggested-load.ts";

test("suggestNextWeightKg adds progress and rounds to 0.5", () => {
  assert.equal(suggestNextWeightKg(80, 0.05), 84);
  assert.equal(suggestNextWeightKg(20, 0.05), 21);
  assert.equal(suggestNextWeightKg(82.5, 0.025), 84.5);
  assert.equal(suggestNextWeightKg(null), null);
});

test("pickLastWorkingWeight skips warmup", () => {
  assert.equal(
    pickLastWorkingWeight([
      { weightKg: 60, setType: "warmup", completed: true },
      { weightKg: 80, setType: "working", completed: true },
      { weightKg: 40, setType: "warmup", completed: true },
    ]),
    80,
  );
  assert.equal(pickLastWorkingWeight([{ weightKg: 20, setType: "working" }]), 20);
  assert.equal(pickLastWorkingWeight([]), null);
});

test("formatSuggestedKg", () => {
  assert.equal(formatSuggestedKg(84), "84");
  assert.equal(formatSuggestedKg(84.5), "84.5");
});
