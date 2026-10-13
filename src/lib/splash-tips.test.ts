import assert from "node:assert/strict";
import { describe, test } from "node:test";
import {
  buildPersonalSplashTip,
  dayPartFromHour,
  greetingForDayPart,
  pickSplashTip,
  shouldSkipRationBrandSplash,
  splashHoldAfterReadyMs,
  SPLASH_BRAND_MIN_MS,
  SPLASH_MIN_VISIBLE_MS,
  SPLASH_OUTRO_MS,
  SPLASH_TIPS,
  BOOT_SPLASH_SESSION_KEY,
  markBootSplashShown,
} from "./splash-tips.ts";

describe("splash-tips", () => {
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

  test("brand splash min is a short beat, not a 3s hold", () => {
    assert.equal(SPLASH_MIN_VISIBLE_MS, SPLASH_BRAND_MIN_MS);
    assert.ok(SPLASH_BRAND_MIN_MS >= 600 && SPLASH_BRAND_MIN_MS <= 1500);
    assert.ok(SPLASH_OUTRO_MS >= 200 && SPLASH_OUTRO_MS <= 800);
  });

  test("splashHoldAfterReadyMs shortens once brand beat elapsed", () => {
    assert.equal(splashHoldAfterReadyMs(0), SPLASH_BRAND_MIN_MS);
    assert.equal(splashHoldAfterReadyMs(SPLASH_BRAND_MIN_MS), SPLASH_OUTRO_MS);
    assert.equal(splashHoldAfterReadyMs(SPLASH_BRAND_MIN_MS + 500), SPLASH_OUTRO_MS);
  });

  test("shouldSkipRationBrandSplash after AuthGate mark", () => {
    const map = new Map<string, string>();
    const storage = {
      getItem(key: string) {
        return map.has(key) ? map.get(key)! : null;
      },
      setItem(key: string, value: string) {
        map.set(key, value);
      },
      removeItem(key: string) {
        map.delete(key);
      },
    };
    Object.defineProperty(globalThis, "sessionStorage", {
      value: storage,
      configurable: true,
    });
    map.clear();
    assert.equal(shouldSkipRationBrandSplash(10_000), false);
    markBootSplashShown(10_000);
    assert.equal(map.get(BOOT_SPLASH_SESSION_KEY), "10000");
    assert.equal(shouldSkipRationBrandSplash(12_000), true);
    assert.equal(shouldSkipRationBrandSplash(30_000), false);
  });

  test("dayPartFromHour maps morning day evening night", () => {
    assert.equal(dayPartFromHour(7), "morning");
    assert.equal(dayPartFromHour(13), "day");
    assert.equal(dayPartFromHour(19), "evening");
    assert.equal(dayPartFromHour(23), "night");
  });

  test("greetingForDayPart returns Russian greetings", () => {
    assert.match(greetingForDayPart("morning"), /утро/i);
    assert.match(greetingForDayPart("evening"), /вечер/i);
  });

  test("buildPersonalSplashTip prefers streak copy", () => {
    const tip = buildPersonalSplashTip({ streak: 5, loggedToday: true, hour: 10 });
    assert.match(tip, /серии|Серия|День 5/i);
  });

  test("buildPersonalSplashTip uses morning greeting without streak", () => {
    const tip = buildPersonalSplashTip({ streak: 0, loggedToday: false, hour: 8 });
    assert.match(tip, /утро/i);
  });

  test("buildPersonalSplashTip prefers Monday week wrap server tip", () => {
    const tip = buildPersonalSplashTip({
      streak: 5,
      loggedToday: true,
      hour: 9,
      serverTip: "Прошлая неделя: 6 из 7 дней. Новая неделя — свежий старт.",
    });
    assert.match(tip, /Прошлая неделя/);
  });
});
