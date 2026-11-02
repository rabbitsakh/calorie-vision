import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { GigaChatApiError } from "./gigachat-errors.ts";
import {
  gigachatRetryDelayMs,
  isRetryableGigaChatError,
  resolveGigaChatHttpTimeoutMs,
  withGigaChatRetry,
} from "./gigachat-resilience.ts";

describe("gigachatRetryDelayMs", () => {
  it("uses exponential delays that match the old 1.2s/2.4s schedule", () => {
    assert.equal(gigachatRetryDelayMs(0), 1200);
    assert.equal(gigachatRetryDelayMs(1), 2400);
    assert.equal(gigachatRetryDelayMs(2), 4800);
  });

  it("caps the wait", () => {
    assert.equal(gigachatRetryDelayMs(20), 15_000);
  });
});

describe("resolveGigaChatHttpTimeoutMs", () => {
  it("defaults to 25s and ignores junk", () => {
    assert.equal(resolveGigaChatHttpTimeoutMs(undefined), 25_000);
    assert.equal(resolveGigaChatHttpTimeoutMs("nope"), 25_000);
    assert.equal(resolveGigaChatHttpTimeoutMs("40000"), 40_000);
  });
});

describe("isRetryableGigaChatError", () => {
  it("retries rate limits, server errors, and timeouts", () => {
    assert.equal(isRetryableGigaChatError(new GigaChatApiError("rate", 429)), true);
    assert.equal(isRetryableGigaChatError(new GigaChatApiError("down", 503)), true);
    assert.equal(isRetryableGigaChatError(new GigaChatApiError("timeout", 504)), true);
  });

  it("does not retry client errors", () => {
    assert.equal(isRetryableGigaChatError(new GigaChatApiError("bad", 400)), false);
    assert.equal(isRetryableGigaChatError(new GigaChatApiError("auth", 401)), false);
    assert.equal(isRetryableGigaChatError(new GigaChatApiError("big", 413)), false);
    assert.equal(isRetryableGigaChatError(new Error("GigaChat не вернул текст ответа")), false);
  });

  it("retries dropped sockets", () => {
    const error = Object.assign(new Error("socket hang up"), { code: "ECONNRESET" });
    assert.equal(isRetryableGigaChatError(error), true);
  });
});

describe("withGigaChatRetry", () => {
  it("backs off and then returns the successful recognition call", async () => {
    const waits: number[] = [];
    let calls = 0;
    const value = await withGigaChatRetry(
      async () => {
        calls += 1;
        if (calls < 3) throw new GigaChatApiError("busy", 429);
        return "ok";
      },
      {
        attempts: 3,
        sleepFn: async (ms) => {
          waits.push(ms);
        },
      },
    );

    assert.equal(value, "ok");
    assert.equal(calls, 3);
    assert.deepEqual(waits, [1200, 2400]);
  });

  it("stops immediately on a non-retryable error", async () => {
    let calls = 0;
    await assert.rejects(
      () =>
        withGigaChatRetry(
          async () => {
            calls += 1;
            throw new GigaChatApiError("bad key", 401);
          },
          {
            attempts: 3,
            sleepFn: async () => {
              throw new Error("should not sleep");
            },
          },
        ),
      (error: unknown) => error instanceof GigaChatApiError && error.status === 401,
    );
    assert.equal(calls, 1);
  });
});
