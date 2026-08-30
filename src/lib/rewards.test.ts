import assert from "node:assert/strict";
import { describe, test } from "node:test";
import {
  challengeChestSourceKey,
  META_OWNED_THRESHOLDS,
  PITY_CHEST_EVERY,
  pendingMetaMilestones,
  pickRewardKey,
  QUEST_DAYS_PER_CHEST,
  questChestSourceKey,
  rewardDef,
  REWARD_DEFS,
  chestPoolDefs,
  streakChestSourceKey,
  weekChestSourceKey,
} from "./rewards.ts";

describe("rewards", () => {
  test("catalog has groups and rarities", () => {
    assert.ok(REWARD_DEFS.length >= 18);
    assert.ok(chestPoolDefs().length >= 15);
    for (const r of REWARD_DEFS) {
      assert.ok(r.key.length > 0);
      assert.ok(r.group);
      assert.ok(r.rarity);
      assert.equal(rewardDef(r.key)?.title, r.title);
    }
  });

  test("pickRewardKey prefers unowned and skips meta-only", () => {
    const owned = chestPoolDefs().slice(0, 3).map((r) => r.key);
    const picked = pickRewardKey(owned, 0);
    assert.ok(!owned.includes(picked));
    assert.equal(rewardDef(picked)?.metaOnly, undefined);
  });

  test("pickRewardKey recycles when all owned", () => {
    const all = chestPoolDefs().map((r) => r.key);
    const picked = pickRewardKey(all, 2);
    assert.ok(all.includes(picked));
  });

  test("pity forces rare+ on Nth grant when available", () => {
    const commons = chestPoolDefs().filter((r) => r.rarity === "common").map((r) => r.key);
    const picked = pickRewardKey(commons, 1, {
      priorGrantCount: PITY_CHEST_EVERY - 1,
      pityEvery: PITY_CHEST_EVERY,
    });
    const def = rewardDef(picked);
    assert.ok(def);
    assert.ok(def!.rarity === "rare" || def!.rarity === "festive");
  });

  test("pending meta milestones for owned count", () => {
    const owned = chestPoolDefs()
      .slice(0, META_OWNED_THRESHOLDS[0])
      .map((r) => r.key);
    const pending = pendingMetaMilestones(owned, []);
    assert.ok(pending.some((m) => m.sourceKey === `meta:count:${META_OWNED_THRESHOLDS[0]}`));
    const already = pendingMetaMilestones(owned, [`meta:count:${META_OWNED_THRESHOLDS[0]}`]);
    assert.ok(!already.some((m) => m.sourceKey === `meta:count:${META_OWNED_THRESHOLDS[0]}`));
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
