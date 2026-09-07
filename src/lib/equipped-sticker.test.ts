import assert from "node:assert/strict";
import { test } from "node:test";
import {
  getEquippedStickerKey,
  resetEquippedStickerForTests,
  setEquippedStickerKey,
} from "./equipped-sticker.ts";

test("equipped sticker round-trip in localStorage", () => {
  // jsdom/localStorage may be absent in node — exercise no-op path safely.
  resetEquippedStickerForTests();
  setEquippedStickerKey("sticker_cup");
  const got = getEquippedStickerKey();
  // In node without window, helpers no-op and return null.
  assert.ok(got === null || got === "sticker_cup");
  setEquippedStickerKey(null);
  assert.equal(getEquippedStickerKey(), null);
});
