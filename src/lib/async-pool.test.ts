import assert from "node:assert/strict";
import { test } from "node:test";
import { mapPool, withTimeoutFallback } from "./async-pool.ts";

test("mapPool respects concurrency and preserves order", async () => {
  const active: number[] = [];
  let peak = 0;

  const results = await mapPool([1, 2, 3, 4, 5], 2, async (value) => {
    active.push(value);
    peak = Math.max(peak, active.length);
    await new Promise((resolve) => setTimeout(resolve, 20));
    active.splice(active.indexOf(value), 1);
    return value * 10;
  });

  assert.deepEqual(results, [10, 20, 30, 40, 50]);
  assert.ok(peak <= 2);
});

test("withTimeoutFallback returns fallback when work is slow", async () => {
  const slow = new Promise<string>((resolve) => setTimeout(() => resolve("late"), 50));
  const value = await withTimeoutFallback(slow, 5, "fallback");
  assert.equal(value, "fallback");
});

test("withTimeoutFallback calls onTimeout when budget expires", async () => {
  let timedOut = false;
  const slow = new Promise<string>((resolve) => setTimeout(() => resolve("late"), 50));
  const value = await withTimeoutFallback(slow, 5, "fallback", () => {
    timedOut = true;
  });
  assert.equal(value, "fallback");
  assert.equal(timedOut, true);
});
