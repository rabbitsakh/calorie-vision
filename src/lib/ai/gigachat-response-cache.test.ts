import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";
import {
  chatResponseCacheKey,
  readResponseCache,
  resetResponseCacheForTests,
  visionResultCacheKey,
  writeResponseCache,
} from "./gigachat-response-cache.ts";

describe("gigachat response cache", () => {
  const previousFlag = process.env.GIGACHAT_RESPONSE_CACHE;
  const previousTtl = process.env.GIGACHAT_RESPONSE_CACHE_TTL_MS;

  afterEach(() => {
    resetResponseCacheForTests();
    if (previousFlag === undefined) delete process.env.GIGACHAT_RESPONSE_CACHE;
    else process.env.GIGACHAT_RESPONSE_CACHE = previousFlag;
    if (previousTtl === undefined) delete process.env.GIGACHAT_RESPONSE_CACHE_TTL_MS;
    else process.env.GIGACHAT_RESPONSE_CACHE_TTL_MS = previousTtl;
  });

  it("returns the same text for an identical chat request and misses on a different one", () => {
    const left = chatResponseCacheKey({
      model: "GigaChat-2-Max",
      temperature: 0.2,
      messages: [{ role: "user", content: "гречка" }],
    });
    const right = chatResponseCacheKey({
      model: "GigaChat-2-Max",
      temperature: 0.2,
      messages: [{ role: "user", content: "рис" }],
    });
    assert.notEqual(left, right);

    writeResponseCache(left, "{\"dishName\":\"гречка\"}", 1_000);
    assert.equal(readResponseCache(left, 1_500), "{\"dishName\":\"гречка\"}");
    assert.equal(readResponseCache(right, 1_500), null);
  });

  it("keys identical images together and different bytes apart", () => {
    const image = Buffer.from("same-jpeg-bytes");
    const hints = { barcodeHint: "4600000000000", aspectRatio: 1.2 };
    const a = visionResultCacheKey({
      model: "GigaChat-2-Max",
      variant: "main",
      hints,
      image,
    });
    const b = visionResultCacheKey({
      model: "GigaChat-2-Max",
      variant: "main",
      hints: { aspectRatio: 1.2, barcodeHint: "4600000000000" },
      image,
    });
    const c = visionResultCacheKey({
      model: "GigaChat-2-Max",
      variant: "main",
      hints,
      image: Buffer.from("other-jpeg-bytes"),
    });
    assert.equal(a, b);
    assert.notEqual(a, c);
  });

  it("expires entries after the TTL", () => {
    process.env.GIGACHAT_RESPONSE_CACHE_TTL_MS = "5000";
    const key = chatResponseCacheKey({
      model: "m",
      temperature: 0,
      messages: [{ role: "user", content: "суп" }],
    });
    writeResponseCache(key, "cached", 10_000);
    assert.equal(readResponseCache(key, 14_999), "cached");
    assert.equal(readResponseCache(key, 15_000), null);
  });

  it("stays disabled when GIGACHAT_RESPONSE_CACHE=0", () => {
    process.env.GIGACHAT_RESPONSE_CACHE = "0";
    const key = chatResponseCacheKey({
      model: "m",
      temperature: 0.35,
      messages: [],
    });
    writeResponseCache(key, "hidden", 1);
    assert.equal(readResponseCache(key, 2), null);
  });
});
