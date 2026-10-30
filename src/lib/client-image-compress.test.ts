import assert from "node:assert/strict";
import { test } from "node:test";
import { compressImageFileForUpload } from "./client-image-compress.ts";

test("compressImageFileForUpload is a no-op without DOM / for non-images", async () => {
  const text = new File(["hello"], "note.txt", { type: "text/plain" });
  assert.equal(await compressImageFileForUpload(text), text);
  const tiny = new File([new Uint8Array(100)], "tiny.jpg", { type: "image/jpeg" });
  assert.equal(await compressImageFileForUpload(tiny), tiny);
});
