import assert from "node:assert/strict";
import { test } from "node:test";
import { imagePathRefersToUpload, resolveLegacyImageId } from "./upload.ts";
import { MAX_UPLOAD_INPUT_BYTES } from "./upload-limits.ts";
import { WATER_DAILY_TARGET_ML, WATER_HABIT_DAY_ML } from "./water-target.ts";

test("resolveLegacyImageId parses api and legacy paths", () => {
  assert.equal(resolveLegacyImageId("/api/uploads/abc-123"), "abc-123");
  assert.equal(resolveLegacyImageId("/uploads/abc-123.webp"), "abc-123");
  assert.equal(resolveLegacyImageId("https://x/api/uploads/abc-123?x=1"), "abc-123");
  assert.equal(resolveLegacyImageId("/other"), null);
});

test("imagePathRefersToUpload matches resolved id", () => {
  assert.equal(imagePathRefersToUpload("/api/uploads/abc-123", "abc-123"), true);
  assert.equal(imagePathRefersToUpload("/uploads/abc-123.jpg", "abc-123"), true);
  assert.equal(imagePathRefersToUpload("/api/uploads/other", "abc-123"), false);
  assert.equal(imagePathRefersToUpload(null, "abc-123"), false);
});

test("upload size limit is at least 8 MB", () => {
  assert.ok(MAX_UPLOAD_INPUT_BYTES >= 8 * 1024 * 1024);
});

test("water targets: daily goal 2000, habit day 1500", () => {
  assert.equal(WATER_DAILY_TARGET_ML, 2000);
  assert.equal(WATER_HABIT_DAY_ML, 1500);
  assert.ok(WATER_HABIT_DAY_ML < WATER_DAILY_TARGET_ML);
});
