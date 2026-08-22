import assert from "node:assert/strict";
import { test } from "node:test";
import { checkRateLimit, checkRateLimitAsync, resetRateLimitsForTests } from "./rate-limit.ts";

test("allows requests under the limit within the window", () => {
  resetRateLimitsForTests();
  const now = 1_000_000;
  assert.deepEqual(checkRateLimit("user:1", 2, 60_000, now), { allowed: true, retryAfterSec: 0 });
  assert.deepEqual(checkRateLimit("user:1", 2, 60_000, now + 1), { allowed: true, retryAfterSec: 0 });
  assert.deepEqual(checkRateLimit("user:1", 2, 60_000, now + 2), { allowed: false, retryAfterSec: 60 });
});

test("resets the bucket after the window expires", () => {
  resetRateLimitsForTests();
  const now = 2_000_000;
  checkRateLimit("user:2", 1, 10_000, now);
  assert.equal(checkRateLimit("user:2", 1, 10_000, now + 1).allowed, false);
  assert.equal(checkRateLimit("user:2", 1, 10_000, now + 10_001).allowed, true);
});

test("async rate limit falls back to memory without REDIS_URL", async () => {
  resetRateLimitsForTests();
  delete process.env.REDIS_URL;
  const now = 3_000_000;
  assert.deepEqual(await checkRateLimitAsync("user:3", 2, 60_000, now), {
    allowed: true,
    retryAfterSec: 0,
  });
  assert.deepEqual(await checkRateLimitAsync("user:3", 2, 60_000, now + 1), {
    allowed: true,
    retryAfterSec: 0,
  });
  assert.equal((await checkRateLimitAsync("user:3", 2, 60_000, now + 2)).allowed, false);
});
