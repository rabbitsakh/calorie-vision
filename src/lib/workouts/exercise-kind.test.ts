import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  EXERCISE_KINDS,
  fieldsForKind,
  isExerciseKind,
  kindUsesSetTypes,
  parseExerciseKind,
} from "./exercise-kind.ts";
import { parseSetCreateForKind, parseSetPatchForKind } from "./set-fields.ts";

describe("exercise kinds", () => {
  it("accepts all Hevy-style kinds", () => {
    for (const k of EXERCISE_KINDS) {
      assert.equal(isExerciseKind(k), true);
      assert.ok(fieldsForKind(k));
    }
    assert.equal(parseExerciseKind("weighted_bw"), "weighted_bw");
    assert.equal(parseExerciseKind("nope"), "strength");
  });

  it("maps fields correctly", () => {
    assert.deepEqual(fieldsForKind("bodyweight"), {
      usesWeight: false,
      usesReps: true,
      usesDistance: false,
      usesDuration: false,
      countsTowardLoad: false,
    });
    assert.equal(fieldsForKind("weighted_bw").countsTowardLoad, true);
    assert.equal(fieldsForKind("assisted").countsTowardLoad, false);
    assert.equal(fieldsForKind("duration").usesDuration, true);
  });

  it("cardio has no set-type chips", () => {
    assert.equal(kindUsesSetTypes("cardio"), false);
    assert.equal(kindUsesSetTypes("strength"), true);
    assert.equal(kindUsesSetTypes("duration"), true);
  });
});

describe("parseSetCreateForKind", () => {
  it("parses strength / weighted / assisted", () => {
    for (const kind of ["strength", "weighted_bw", "assisted"] as const) {
      const r = parseSetCreateForKind(kind, { weightKg: 20, reps: 8 });
      assert.equal(r.ok, true);
      if (r.ok) {
        assert.equal(r.fields.weightKg, 20);
        assert.equal(r.fields.reps, 8);
        assert.equal(r.fields.distanceKm, null);
      }
    }
  });

  it("parses bodyweight reps only", () => {
    const r = parseSetCreateForKind("bodyweight", { reps: 12 });
    assert.equal(r.ok, true);
    if (r.ok) {
      assert.equal(r.fields.weightKg, null);
      assert.equal(r.fields.reps, 12);
    }
    assert.equal(parseSetCreateForKind("bodyweight", { reps: 0 }).ok, false);
  });

  it("parses duration holds", () => {
    const r = parseSetCreateForKind("duration", { durationSec: 45 });
    assert.equal(r.ok, true);
    if (r.ok) {
      assert.equal(r.fields.durationSec, 45);
      assert.equal(r.fields.distanceKm, null);
    }
  });

  it("parses cardio km + time", () => {
    const r = parseSetCreateForKind("cardio", { distanceKm: 5, durationSec: 1500 });
    assert.equal(r.ok, true);
    if (r.ok) assert.equal(r.fields.distanceKm, 5);
  });
});

describe("parseSetPatchForKind", () => {
  it("nulls unused columns for bodyweight", () => {
    const r = parseSetPatchForKind("bodyweight", { reps: 10 });
    assert.equal(r.ok, true);
    if (r.ok) {
      assert.equal(r.fields.reps, 10);
      assert.equal(r.fields.weightKg, null);
      assert.equal(r.fields.distanceKm, null);
      assert.equal(r.fields.durationSec, null);
    }
  });
});
