import assert from "node:assert/strict";
import { test } from "node:test";
import { nextBadgeHint } from "./badges.ts";

test("nextBadgeHint picks first_log when no meals yet", () => {
  const hint = nextBadgeHint([], {
    streak: 0,
    mealCount: 0,
    waterStreak: 0,
    onTargetDays: 0,
    weightLogCount: 0,
  });
  assert.equal(hint?.key, "first_log");
  assert.equal(hint?.current, 0);
  assert.equal(hint?.target, 1);
});

test("nextBadgeHint prefers closest progress among locked badges", () => {
  const hint = nextBadgeHint(["first_log", "streak_3", "meals_10", "water_3"], {
    streak: 5,
    mealCount: 12,
    waterStreak: 2,
    onTargetDays: 1,
    weightLogCount: 1,
  });
  assert.equal(hint?.key, "streak_7");
  assert.equal(hint?.current, 5);
  assert.equal(hint?.target, 7);
  assert.ok((hint?.ratio ?? 0) > 0.6);
});

test("nextBadgeHint returns null when all unlocked", () => {
  const hint = nextBadgeHint(
    [
      "first_log",
      "streak_3",
      "streak_7",
      "streak_30",
      "meals_10",
      "meals_100",
      "meals_500",
      "water_3",
      "water_7",
      "week_on_target",
      "weight_5",
    ],
    { streak: 40, mealCount: 520, waterStreak: 10, onTargetDays: 6, weightLogCount: 10 },
  );
  assert.equal(hint, null);
});
