import assert from "node:assert/strict";
import { describe, test } from "node:test";
import {
  challengeChestSourceKey,
  pickRewardKey,
  rewardDef,
  REWARD_DEFS,
} from "./rewards.ts";

describe("rewards", () => {
  test("catalog has at least 5 wave-1 rewards", () => {
    assert.ok(REWARD_DEFS.length >= 5);
    for (const r of REWARD_DEFS) {
      assert.ok(r.key.length > 0);
      assert.ok(r.title.length > 0);
      assert.ok(rewardDef(r.key)?.title === r.title);
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

  test("challengeChestSourceKey is stable", () => {
    assert.equal(
      challengeChestSourceKey("2026-08-24", "breakfast_7"),
      "challenge:2026-08-24:breakfast_7",
    );
  });
});
