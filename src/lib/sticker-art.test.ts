import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { isStickerArtKey } from "../components/StickerArt.tsx";
import { stickerGlyph } from "./rewards.ts";

describe("StickerArt keys", () => {
  test("covers every stickerGlyph catalog key", () => {
    const keys = [
      "sticker_sprout",
      "sticker_cup",
      "sticker_sunrise",
      "sticker_plate",
      "sticker_moon",
      "sticker_leaf",
      "sticker_berry",
      "sticker_steam",
      "sticker_path",
      "sticker_star",
    ];
    for (const key of keys) {
      assert.equal(isStickerArtKey(key), true, key);
      assert.ok(stickerGlyph(key).length > 0, key);
    }
  });

  test("rejects unknown keys", () => {
    assert.equal(isStickerArtKey("cheer_steady"), false);
    assert.equal(isStickerArtKey(null), false);
    assert.equal(isStickerArtKey(""), false);
  });
});
