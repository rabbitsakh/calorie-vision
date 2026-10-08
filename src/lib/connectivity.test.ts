import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { isLikelyOfflineError } from "./connectivity.ts";

describe("isLikelyOfflineError", () => {
  it("matches network fetch failures", () => {
    assert.equal(isLikelyOfflineError(new Error("Failed to fetch")), true);
    assert.equal(isLikelyOfflineError(new Error("Load failed")), true);
    assert.equal(isLikelyOfflineError(new TypeError("NetworkError when attempting to fetch")), true);
  });

  it("does not treat arbitrary errors as offline", () => {
    assert.equal(isLikelyOfflineError(new Error("Фото не найдено")), false);
    assert.equal(isLikelyOfflineError(null), false);
    assert.equal(isLikelyOfflineError("offline"), false);
  });
});
