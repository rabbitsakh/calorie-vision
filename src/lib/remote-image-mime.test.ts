import assert from "node:assert/strict";
import { test } from "node:test";
import { getImageMimeType, looksLikeImageBuffer } from "./ai/image-utils.ts";

/** Mirrors saveRemoteImage content-type gate for product CDNs that lie. */
function acceptRemoteImageContentType(contentType: string, buffer: Buffer): boolean {
  const ct = contentType.split(";")[0]!.trim();
  if (ct.startsWith("image/") && ct !== "image/svg+xml") return true;
  if ((!ct || ct === "application/octet-stream") && looksLikeImageBuffer(buffer)) {
    return true;
  }
  return false;
}

test("accepts PNG served as application/octet-stream (ime.by-style CDNs)", () => {
  const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]);
  assert.equal(acceptRemoteImageContentType("application/octet-stream", png), true);
  assert.equal(getImageMimeType("https://cdn.example/a.png", png), "image/png");
  assert.equal(acceptRemoteImageContentType("application/octet-stream", Buffer.from("nope")), false);
  assert.equal(acceptRemoteImageContentType("image/svg+xml", png), false);
});
