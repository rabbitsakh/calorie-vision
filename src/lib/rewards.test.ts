import assert from "node:assert/strict";
import { describe, test } from "node:test";
import {
  challengeChestSourceKey,
  PITY_CHEST_EVERY,
  pickRewardKey,
  QUEST_DAYS_PER_CHEST,
  questChestSourceKey,
  rewardDef,
  REWARD_DEFS,
  streakChestSourceKey,
  weekChestSourceKey,
} from "./rewards.ts";

describe("rewards", () => {
  test("catalog has groups and rarities", () => {
    assert.ok(REWARD_DEFS.length >= 10);
    for (const r of REWARD_DEFS) {
      assert.ok(r.key.length > 0);
      assert.ok(r.group);
      assert.ok(r.rarity);
      assert.equal(rewardDef(r.key)?.title, r.title);
    }
  });

  test("pickRewardKey prefers unowned", () => {
    const owned = REWARD_DEFS.slice(0, 3).map((r) => r.key);
    const picked = pickRewardKey(owned, 0);
    assert.ok(!owned.includes(picked));
  });

  test("pickRewardKey recycles when all owned", () => {
    const all = REWARD_DEFS.map((r) => r.key);
    const picked = pickRewardKey(all, 2);
    assert.ok(all.includes(picked));
  });

  test("pity forces rare+ on Nth grant when available", () => {
    const commons = REWARD_DEFS.filter((r) => r.rarity === "common").map((r) => r.key);
    const picked = pickRewardKey(commons, 1, {
      priorGrantCount: PITY_CHEST_EVERY - 1,
      pityEvery: PITY_CHEST_EVERY,
    });
    const def = rewardDef(picked);
    assert.ok(def);
    assert.ok(def!.rarity === "rare" || def!.rarity === "festive");
  });

  test("source keys are stable", () => {
    assert.equal(
      challengeChestSourceKey("2026-08-24", "breakfast_7"),
      "challenge:2026-08-24:breakfast_7",
    );
    assert.equal(streakChestSourceKey(14), "streak:14");
    assert.equal(weekChestSourceKey("2026-08-24"), "week:2026-08-24");
    assert.equal(questChestSourceKey(2), "quest-chest:2");
    assert.equal(QUEST_DAYS_PER_CHEST, 3);
  });
});
