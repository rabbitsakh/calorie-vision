import assert from "node:assert/strict";
import { test } from "node:test";
import { nextBadgeHint } from "./badges.ts";

test("nextBadgeHint picks first_log when no meals yet", () => {
  const hint = nextBadgeHint([], {
    streak: 0,
    mealCount: 0,
    waterStreak: 0,
    onTargetDays: 0,
  });
  assert.equal(hint?.key, "first_log");
  assert.equal(hint?.current, 0);
  assert.equal(hint?.target, 1);
});

test("nextBadgeHint prefers closest progress among locked badges", () => {
  const hint = nextBadgeHint(["first_log"], {
    streak: 5,
    mealCount: 12,
    waterStreak: 2,
    onTargetDays: 1,
  });
  assert.equal(hint?.key, "streak_7");
  assert.equal(hint?.current, 5);
  assert.equal(hint?.target, 7);
  assert.ok((hint?.ratio ?? 0) > 0.6);
});

test("nextBadgeHint returns null when all unlocked", () => {
  const hint = nextBadgeHint(
    ["first_log", "streak_7", "streak_30", "meals_100", "water_7", "week_on_target"],
    { streak: 40, mealCount: 120, waterStreak: 10, onTargetDays: 6 },
  );
  assert.equal(hint, null);
});
