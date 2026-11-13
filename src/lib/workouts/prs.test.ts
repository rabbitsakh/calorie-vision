import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  computeExercisePrs,
  countPrsBySessionId,
  describePrBeat,
  estimated1Rm,
  formatPrSummary,
  formatSessionPrLabel,
  mergeExercisePrs,
  prHitsBySessionId,
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

describe("countPrsBySessionId", () => {
  it("counts first session and later beats", () => {
    const counts = countPrsBySessionId([
      {
        id: "s1",
        date: "2026-01-01",
        createdAt: "2026-01-01T10:00:00.000Z",
        exercises: [
          {
            name: "Жим",
            kind: "strength",
            sets: [{ weightKg: 80, reps: 5, completed: true }],
          },
        ],
      },
      {
        id: "s2",
        date: "2026-01-08",
        createdAt: "2026-01-08T10:00:00.000Z",
        exercises: [
          {
            name: "Жим",
            kind: "strength",
            sets: [{ weightKg: 90, reps: 5, completed: true }],
          },
        ],
      },
      {
        id: "s3",
        date: "2026-01-15",
        createdAt: "2026-01-15T10:00:00.000Z",
        exercises: [
          {
            name: "Жим",
            kind: "strength",
            sets: [{ weightKg: 85, reps: 5, completed: true }],
          },
        ],
      },
    ]);
    assert.equal(counts.get("s1"), 1);
    assert.equal(counts.get("s2"), 1);
    assert.equal(counts.get("s3"), 0);
  });

  it("same catalogId is one line even when the logged name changed", () => {
    const hits = prHitsBySessionId([
      {
        id: "s1",
        date: "2026-02-01",
        createdAt: "2026-02-01T10:00:00.000Z",
        exercises: [
          {
            name: "жим лежа",
            catalogId: "bench-press",
            kind: "strength",
            sets: [{ weightKg: 80, reps: 5, completed: true }],
          },
        ],
      },
      {
        id: "s2",
        date: "2026-02-08",
        createdAt: "2026-02-08T10:00:00.000Z",
        exercises: [
          {
            name: "Жим штанги лёжа",
            catalogId: "bench-press",
            kind: "strength",
            sets: [{ weightKg: 70, reps: 5, completed: true }],
          },
        ],
      },
      {
        id: "s3",
        date: "2026-02-15",
        createdAt: "2026-02-15T10:00:00.000Z",
        exercises: [
          {
            name: "Жим штанги лёжа",
            catalogId: "bench-press",
            kind: "strength",
            sets: [{ weightKg: 90, reps: 3, completed: true }],
          },
        ],
      },
    ]);
    assert.equal(hits.get("s1")?.length, 1);
    assert.equal(hits.get("s2")?.length, 0);
    assert.equal(hits.get("s3")?.length, 1);
    assert.match(formatSessionPrLabel(hits.get("s3")![0]!), /Жим штанги лёжа · рекорд 90 кг/);
  });
});

describe("describePrBeat", () => {
  it("fires when heaviest kg improves", () => {
    const before = computeExercisePrs("strength", [{ weightKg: 80, reps: 5, completed: true }]);
    const after = computeExercisePrs("strength", [
      { weightKg: 80, reps: 5, completed: true },
      { weightKg: 85, reps: 3, completed: true },
    ]);
    const beat = describePrBeat(before, after);
    assert.ok(beat && beat.includes("85"));
  });

  it("null when no improvement", () => {
    const before = computeExercisePrs("strength", [{ weightKg: 100, reps: 5, completed: true }]);
    const after = computeExercisePrs("strength", [
      { weightKg: 100, reps: 5, completed: true },
      { weightKg: 90, reps: 8, completed: true },
    ]);
    assert.equal(describePrBeat(before, after), null);
  });
});
