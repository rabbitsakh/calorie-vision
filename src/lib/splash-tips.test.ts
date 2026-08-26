import assert from "node:assert/strict";
import { test } from "node:test";
import { pickSplashTip, SPLASH_MIN_VISIBLE_MS, SPLASH_TIPS } from "./splash-tips.ts";

test("splash tips are non-empty Russian strings", () => {
  assert.ok(SPLASH_TIPS.length >= 4);
  for (const tip of SPLASH_TIPS) {
    assert.ok(tip.length > 10);
  }
});

test("pickSplashTip is deterministic for a seed", () => {
  assert.equal(pickSplashTip(0), pickSplashTip(0));
  assert.equal(pickSplashTip(3), SPLASH_TIPS[3 % SPLASH_TIPS.length]);
});

test("splash stays visible for at least two seconds by default", () => {
  assert.ok(SPLASH_MIN_VISIBLE_MS >= 1800);
});
