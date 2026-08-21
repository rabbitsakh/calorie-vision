import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { isHeicBuffer, looksLikeImageBuffer } from "./ai/image-utils.ts";

describe("image buffer detection", () => {
  it("detects HEIC ftyp brands", () => {
    const heic = Buffer.alloc(16);
    heic.writeUInt32BE(0x10, 0);
    heic.write("ftyp", 4, "ascii");
    heic.write("heic", 8, "ascii");
    assert.equal(isHeicBuffer(heic), true);
    assert.equal(looksLikeImageBuffer(heic), true);
  });

  it("detects JPEG magic", () => {
    const jpeg = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 0, 0, 0]);
    assert.equal(looksLikeImageBuffer(jpeg), true);
    assert.equal(isHeicBuffer(jpeg), false);
  });

  it("rejects random bytes", () => {
    assert.equal(looksLikeImageBuffer(Buffer.from("not-an-image")), false);
  });
});
