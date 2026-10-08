import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  clearProbeOnlineCache,
  isLikelyOfflineError,
  probeOnline,
} from "./connectivity.ts";

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

describe("probeOnline cache", () => {
  it("reuses a short TTL result", async () => {
    clearProbeOnlineCache();
    let calls = 0;
    const originalFetch = globalThis.fetch;
    globalThis.fetch = (async () => {
      calls += 1;
      return new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }) as typeof fetch;

    Object.defineProperty(globalThis, "window", {
      value: globalThis,
      configurable: true,
    });

    try {
      assert.equal(await probeOnline(1000, { cacheMs: 60_000 }), true);
      assert.equal(await probeOnline(1000, { cacheMs: 60_000 }), true);
      assert.equal(calls, 1);
      assert.equal(await probeOnline(1000, { bypassCache: true, cacheMs: 60_000 }), true);
      assert.equal(calls, 2);
    } finally {
      globalThis.fetch = originalFetch;
      clearProbeOnlineCache();
    }
  });
});
