import assert from "node:assert/strict";
import test from "node:test";
import { signUploadAccess, verifyUploadAccess } from "@/lib/upload-sign";

test("signUploadAccess round-trips verification", () => {
  const { exp, sig } = signUploadAccess("abc-123", "user-1", 120);
  assert.equal(verifyUploadAccess("abc-123", String(exp), "user-1", sig), true);
  assert.equal(verifyUploadAccess("abc-123", String(exp), "other", sig), false);
  assert.equal(verifyUploadAccess("other", String(exp), "user-1", sig), false);
});

test("expired signature is rejected", () => {
  const { sig } = signUploadAccess("abc-123", "user-1", -10);
  const exp = Math.floor(Date.now() / 1000) - 10;
  assert.equal(verifyUploadAccess("abc-123", String(exp), "user-1", sig), false);
});
