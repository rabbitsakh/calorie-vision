import assert from "node:assert/strict";
import { describe, test } from "node:test";
import {
  buildChestMeter,
  nextQuestChestBatchIndex,
} from "./chest-progress.ts";

describe("buildChestMeter", () => {
  test("empty → need full cycle", () => {
    const m = buildChestMeter({ questDayCount: 0, openedQuestChests: 0, questDaysPerChest: 3 });
    assert.equal(m.state, "empty");
    assert.equal(m.nextIn, 3);
    assert.equal(m.filled, 0);
    assert.equal(m.cta, "none");
  });

  test("mid cycle filling", () => {
    const m = buildChestMeter({ questDayCount: 1, openedQuestChests: 0, questDaysPerChest: 3 });
    assert.equal(m.state, "filling");
    assert.equal(m.filled, 1);
    assert.equal(m.nextIn, 2);
    assert.equal(m.cta, "none");
  });

  test("one day left", () => {
    const m = buildChestMeter({ questDayCount: 2, openedQuestChests: 0, questDaysPerChest: 3 });
    assert.equal(m.state, "filling");
    assert.equal(m.nextIn, 1);
    assert.match(m.detail, /сегодня/i);
  });

  test("earned but unopened → ready CTA", () => {
    const m = buildChestMeter({ questDayCount: 3, openedQuestChests: 0, questDaysPerChest: 3 });
    assert.equal(m.state, "ready");
    assert.equal(m.readyCount, 1);
    assert.equal(m.cta, "open");
    assert.equal(m.nextIn, 0);
    assert.equal(m.filled, 3);
  });

  test("after open, next cycle starts empty fill", () => {
    const m = buildChestMeter({ questDayCount: 3, openedQuestChests: 1, questDaysPerChest: 3 });
    assert.equal(m.state, "filling");
    assert.equal(m.readyCount, 0);
    assert.equal(m.filled, 0);
    assert.equal(m.nextIn, 3);
    assert.equal(m.cta, "none");
  });

  test("meta line from owned count", () => {
    const m = buildChestMeter({
      questDayCount: 1,
      openedQuestChests: 0,
      ownedCount: 4,
    });
    assert.ok(m.metaLabel);
    assert.match(m.metaLabel!, /мета/);
  });
});

describe("nextQuestChestBatchIndex", () => {
  test("null when nothing ready", () => {
    assert.equal(nextQuestChestBatchIndex(2, 0, 3), null);
    assert.equal(nextQuestChestBatchIndex(3, 1, 3), null);
  });

  test("returns next 1-based batch", () => {
    assert.equal(nextQuestChestBatchIndex(3, 0, 3), 1);
    assert.equal(nextQuestChestBatchIndex(6, 1, 3), 2);
  });
});
