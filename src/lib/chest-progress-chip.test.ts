import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { buildChestProgressChip } from "./chest-progress-chip.ts";

describe("buildChestProgressChip", () => {
  test("empty progress nudges to close days today", () => {
    const m = buildChestProgressChip({ questDayCount: 0, questDaysPerChest: 3 });
    assert.equal(m.href, "habits");
    assert.match(m.label, /сегодня/);
    assert.match(m.label, /3/);
    assert.equal(m.nextIn, 3);
    assert.equal(m.filled, 0);
    assert.equal(m.per, 3);
  });

  test("one day left → закрой сегодня", () => {
    const m = buildChestProgressChip({ questDayCount: 2, questDaysPerChest: 3 });
    assert.equal(m.label, "Сундук · закрой сегодня");
    assert.equal(m.href, "habits");
    assert.equal(m.nextIn, 1);
    assert.equal(m.filled, 2);
    assert.equal(m.per, 3);
  });

  test("after a chest cycle, next needs full per days — still habits", () => {
    const m = buildChestProgressChip({ questDayCount: 3, questDaysPerChest: 3 });
    assert.equal(m.nextIn, 3);
    assert.match(m.label, /ещё 3/);
    assert.match(m.label, /сегодня/);
    assert.equal(m.href, "habits");
    assert.equal(m.filled, 0);
  });

  test("mid progress shows remaining days and bar fill", () => {
    const m = buildChestProgressChip({ questDayCount: 1, questDaysPerChest: 3 });
    assert.equal(m.nextIn, 2);
    assert.match(m.label, /ещё 2/);
    assert.match(m.label, /сегодня/);
    assert.equal(m.href, "habits");
    assert.equal(m.filled, 1);
    assert.equal(m.per, 3);
  });

  test("meta line from owned count", () => {
    const m = buildChestProgressChip({
      questDayCount: 1,
      questDaysPerChest: 3,
      ownedCount: 4,
    });
    assert.ok(m.metaLabel);
    assert.match(m.metaLabel!, /мета/);
  });
});
