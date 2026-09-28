import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { validateSetDraft } from "./set-draft.ts";

const empty = { kg: "", reps: "", km: "", time: "" };

describe("validateSetDraft cardio (+отрезок)", () => {
  it("fails on empty minutes and points at time field", () => {
    const r = validateSetDraft("cardio", empty);
    assert.equal(r.ok, false);
    if (!r.ok) {
      assert.equal(r.field, "time");
      assert.match(r.message, /минут/i);
    }
  });

  it("allows empty km (treated as 0) when minutes are set", () => {
    const r = validateSetDraft("cardio", { ...empty, time: "28" });
    assert.equal(r.ok, true);
    if (r.ok) {
      assert.equal(r.body.distanceKm, 0);
      assert.equal(r.body.durationSec, 28 * 60);
    }
  });

  it("accepts km + minutes", () => {
    const r = validateSetDraft("cardio", { ...empty, km: "5,2", time: "30" });
    assert.equal(r.ok, true);
    if (r.ok) {
      assert.equal(r.body.distanceKm, 5.2);
      assert.equal(r.body.durationSec, 1800);
    }
  });

  it("rejects colon clock times", () => {
    const r = validateSetDraft("cardio", { ...empty, time: "28:12" });
    assert.equal(r.ok, false);
    if (!r.ok) assert.equal(r.field, "time");
  });
});

describe("validateSetDraft strength", () => {
  it("requires reps when kg empty (0 kg allowed)", () => {
    const r = validateSetDraft("strength", empty);
    assert.equal(r.ok, false);
    if (!r.ok) assert.equal(r.field, "reps");
  });

  it("rejects invalid kg text", () => {
    const r = validateSetDraft("strength", { ...empty, kg: "x", reps: "8" });
    assert.equal(r.ok, false);
    if (!r.ok) assert.equal(r.field, "kg");
  });

  it("accepts valid working set", () => {
    const r = validateSetDraft("strength", { ...empty, kg: "60", reps: "8" });
    assert.equal(r.ok, true);
    if (r.ok) {
      assert.equal(r.body.weightKg, 60);
      assert.equal(r.body.reps, 8);
    }
  });
});
