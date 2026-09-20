import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  computeExercisePrs,
  estimated1Rm,
  formatPrSummary,
  mergeExercisePrs,
} from "./prs.ts";

describe("estimated1Rm", () => {
  it("Epley formula", () => {
    assert.equal(estimated1Rm(100, 1), 100);
    assert.equal(estimated1Rm(100, 5), 116.7);
  });
});

describe("computeExercisePrs", () => {
  it("ignores warmup for strength", () => {
    const prs = computeExercisePrs("strength", [
      { weightKg: 60, reps: 10, setType: "warmup", completed: true },
      { weightKg: 100, reps: 5, setType: "working", completed: true },
      { weightKg: 90, reps: 8, setType: "working", completed: true },
    ]);
    assert.equal(prs.kind, "strength");
    if (prs.kind === "strength") {
      assert.equal(prs.heaviestKg, 100);
      assert.equal(prs.heaviestReps, 5);
      assert.equal(prs.bestSetVolume, 720);
      assert.equal(prs.estimated1Rm, 116.7);
    }
  });

  it("cardio best pace and distance", () => {
    const prs = computeExercisePrs("cardio", [
      { distanceKm: 5, durationSec: 1500, setType: "working", completed: true },
      { distanceKm: 10, durationSec: 3600, setType: "working", completed: true },
    ]);
    assert.equal(prs.kind, "cardio");
    if (prs.kind === "cardio") {
      assert.equal(prs.longestDistanceKm, 10);
      assert.equal(prs.bestPaceSecPerKm, 300);
    }
  });

  it("bodyweight max reps", () => {
    const prs = computeExercisePrs("bodyweight", [
      { reps: 8, setType: "working", completed: true },
      { reps: 12, setType: "working", completed: true },
    ]);
    assert.equal(prs.kind, "bodyweight");
    if (prs.kind === "bodyweight") assert.equal(prs.bestReps, 12);
  });
});

describe("merge + format", () => {
  it("merges strength across sessions", () => {
    const a = computeExercisePrs("strength", [{ weightKg: 80, reps: 5, completed: true }]);
    const b = computeExercisePrs("strength", [{ weightKg: 90, reps: 3, completed: true }]);
    const m = mergeExercisePrs([a, b]);
    assert.ok(m && m.kind === "strength");
    if (m && m.kind === "strength") {
      assert.equal(m.heaviestKg, 90);
      assert.ok(formatPrSummary(m)?.includes("90"));
    }
  });
});
