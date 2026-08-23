import assert from "node:assert/strict";
import { test } from "node:test";
import { resolveLegacyImageId, imagePathRefersToUpload } from "./upload.ts";
import { WATER_DAILY_TARGET_ML, WATER_HABIT_DAY_ML } from "./water-target.ts";
import { MAX_UPLOAD_INPUT_BYTES } from "./upload-limits.ts";
import { weekStartMonday as challengesWeekStart } from "./challenges.ts";
import { weekStartMonday as streakWeekStart } from "./streak-utils.ts";

/**
 * Lightweight API-contract / shared-helper smoke tests (no NextRequest).
 * Covers invariants that route handlers rely on after the audit batch.
 */
test("upload ownership helpers share the same id resolution", () => {
  const id = "11111111-2222-3333-4444-555555555555";
  assert.equal(resolveLegacyImageId(`/api/uploads/${id}`), id);
  assert.equal(imagePathRefersToUpload(`/api/uploads/${id}`, id), true);
});

test("water goal is stricter than habit day threshold", () => {
  assert.equal(WATER_DAILY_TARGET_ML, 2000);
  assert.equal(WATER_HABIT_DAY_ML, 1500);
});

test("upload size guard is finite and positive", () => {
  assert.ok(MAX_UPLOAD_INPUT_BYTES > 0);
  assert.ok(Number.isFinite(MAX_UPLOAD_INPUT_BYTES));
});

test("challenges weekStartMonday matches streak-utils (UTC)", () => {
  assert.equal(challengesWeekStart("2026-08-23"), streakWeekStart("2026-08-23"));
  assert.equal(challengesWeekStart("2026-08-23", "UTC"), streakWeekStart("2026-08-23", "UTC"));
});
