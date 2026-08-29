import assert from "node:assert/strict";
import { test } from "node:test";
import {
  BADGE_DEFS,
  emptyBadgeStats,
  MONTH_ON_TARGET_DAYS,
  nextBadgeHint,
  qualifyingBadgeKeys,
} from "./badges.ts";

test("nextBadgeHint picks first_log when no meals yet", () => {
  const hint = nextBadgeHint([], emptyBadgeStats());
  assert.equal(hint?.key, "first_log");
  assert.equal(hint?.current, 0);
  assert.equal(hint?.target, 1);
});

test("nextBadgeHint prefers closest progress among locked badges", () => {
  const hint = nextBadgeHint(["first_log", "streak_3", "meals_10"], {
    ...emptyBadgeStats(),
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

test("nextBadgeHint surfaces early streak_3 before week streak", () => {
  const hint = nextBadgeHint(["first_log"], {
    ...emptyBadgeStats(),
    streak: 2,
    mealCount: 4,
  });
  assert.equal(hint?.key, "streak_3");
  assert.equal(hint?.current, 2);
  assert.equal(hint?.target, 3);
});

test("nextBadgeHint returns null when all unlocked", () => {
  const hint = nextBadgeHint(BADGE_DEFS.map((d) => d.key), {
    ...emptyBadgeStats(),
    streak: 60,
    mealCount: 1000,
    waterStreak: 30,
    onTargetDays: 6,
    monthOnTargetDays: MONTH_ON_TARGET_DAYS,
    weightLogCount: 30,
    challengesCompleted: 12,
  });
  assert.equal(hint, null);
});

test("catalog includes F1 expansion keys", () => {
  const keys = new Set(BADGE_DEFS.map((d) => d.key));
  for (const key of [
    "streak_14",
    "streak_60",
    "meals_50",
    "meals_1000",
    "water_14",
    "water_30",
    "weight_10",
    "weight_30",
    "month_on_target",
    "challenges_1",
    "challenges_4",
    "challenges_12",
  ]) {
    assert.ok(keys.has(key), `missing ${key}`);
  }
});

test("qualifyingBadgeKeys unlocks challenge and month badges", () => {
  const keys = qualifyingBadgeKeys({
    ...emptyBadgeStats(),
    mealCount: 1,
    challengesCompleted: 4,
    monthOnTargetDays: MONTH_ON_TARGET_DAYS,
  });
  assert.ok(keys.includes("first_log"));
  assert.ok(keys.includes("challenges_1"));
  assert.ok(keys.includes("challenges_4"));
  assert.ok(!keys.includes("challenges_12"));
  assert.ok(keys.includes("month_on_target"));
});

test("nextBadgeHint can surface challenges_1", () => {
  const hint = nextBadgeHint(["first_log", "meals_10", "streak_3"], {
    ...emptyBadgeStats(),
    mealCount: 12,
    streak: 3,
    challengesCompleted: 0,
  });
  // challenges_1 at 0/1 has low ratio; streak_7 at 3/7 may win — just ensure function runs
  assert.ok(hint);
  const challengeHint = nextBadgeHint(
    BADGE_DEFS.map((d) => d.key).filter((k) => k !== "challenges_1"),
    { ...emptyBadgeStats(), challengesCompleted: 0 },
  );
  assert.equal(challengeHint?.key, "challenges_1");
});
