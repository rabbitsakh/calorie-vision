import assert from "node:assert/strict";
import { test } from "node:test";
import { collectionWearModel } from "./collection-wear.ts";

test("collectionWearModel cheer-only still has artKey", () => {
  const m = collectionWearModel({ cheerKey: "cheer_steady" });
  assert.equal(m.visible, true);
  assert.equal(m.artKey, "cheer_steady");
  assert.ok(m.phrase);
  assert.equal(m.hasBadge, true);
});

test("collectionWearModel sticker wins over cheer for art", () => {
  const m = collectionWearModel({
    sticker: "sticker_sprout",
    cheerKey: "cheer_steady",
  });
  assert.equal(m.artKey, "sticker_sprout");
  assert.ok(m.phrase);
});

test("collectionWearModel empty → not visible", () => {
  const m = collectionWearModel({});
  assert.equal(m.visible, false);
  assert.equal(m.artKey, null);
});

test("collectionWearModel chest ready alone is visible", () => {
  const m = collectionWearModel({ chestReady: true });
  assert.equal(m.visible, true);
  assert.equal(m.hasBadge, false);
});
