import assert from "node:assert/strict";
import { describe, test } from "node:test";
import {
  buildPersonalSplashTip,
  dayPartFromHour,
  greetingForDayPart,
  pickSplashTip,
  splashMascotPose,
  splashStatusLabel,
  SPLASH_MIN_VISIBLE_MS,
  SPLASH_TIPS,
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

  test("splash stays visible for at least ~3 seconds by default", () => {
    assert.ok(SPLASH_MIN_VISIBLE_MS >= 2800);
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

  test("splashStatusLabel and pose shift when ready", () => {
    assert.equal(splashStatusLabel("boot"), "Открываем рацион…");
    assert.equal(splashStatusLabel("loading"), "Собираем день…");
    assert.equal(splashStatusLabel("ready"), "Готово");
    assert.equal(splashMascotPose("ready"), "cheer");
    assert.equal(splashMascotPose("boot", 5), "streak");
  });
});
