import assert from "node:assert/strict";
import { test } from "node:test";
import { isLikelyIos } from "./push-client.ts";

test("detects classic iPhone user agents", () => {
  assert.equal(
    isLikelyIos(
      "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1",
    ),
    true,
  );
});

test("detects iPad user agents", () => {
  assert.equal(
    isLikelyIos(
      "Mozilla/5.0 (iPad; CPU OS 16_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.4 Mobile/15E148 Safari/604.1",
    ),
    true,
  );
});

test("does not treat desktop Chrome as iOS", () => {
  assert.equal(
    isLikelyIos(
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    ),
    false,
  );
});
