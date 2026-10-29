import assert from "node:assert/strict";
import { test } from "node:test";
import {
  checkTipRateLimit,
  readTipCache,
  resetTipGuardForTests,
  tipCacheTtlSec,
  writeTipCache,
} from "./gigachat-tip-guard.ts";

test("tip cache round-trip in memory", async () => {
  resetTipGuardForTests();
  assert.equal(await readTipCache("t1"), null);
  await writeTipCache("t1", { tip: "привет" }, 60);
  assert.deepEqual(await readTipCache("t1"), { tip: "привет" });
});

test("tipCacheTtlSec is at least 30 minutes", () => {
  assert.ok(tipCacheTtlSec() >= 30 * 60);
  assert.ok(tipCacheTtlSec() <= 36 * 60 * 60);
});

test("checkTipRateLimit allows then eventually blocks", async () => {
  resetTipGuardForTests();
  const user = `u-${Date.now()}`;
  let blocked = false;
  for (let i = 0; i < 40; i++) {
    const r = await checkTipRateLimit("motivation-tip", user);
    if (!r.allowed) {
      blocked = true;
      assert.ok(r.retryAfterSec >= 1);
      break;
    }
  }
  assert.equal(blocked, true);
});
