import assert from "node:assert/strict";
import { test } from "node:test";
import {
  getCachedFileId,
  imageUploadCacheKey,
  rememberCachedFileId,
  resetFileIdCacheForTests,
} from "./gigachat-file-cache.ts";

test("fileId cache stores and returns uploads by image hash", () => {
  resetFileIdCacheForTests();
  const buffer = Buffer.from("same-image-bytes");
  const key = imageUploadCacheKey(buffer);

  assert.equal(getCachedFileId(key), null);
  rememberCachedFileId(key, "file-123");
  assert.equal(getCachedFileId(key), "file-123");
});

test("fileId cache keys differ for different buffers", () => {
  resetFileIdCacheForTests();
  const left = imageUploadCacheKey(Buffer.from("left"));
  const right = imageUploadCacheKey(Buffer.from("right"));
  assert.notEqual(left, right);
});
