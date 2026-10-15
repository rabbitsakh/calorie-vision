import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { buildChestProgressChip } from "./chest-progress-chip.ts";

describe("buildChestProgressChip", () => {
  test("empty progress nudges to close days", () => {
    const m = buildChestProgressChip({ questDayCount: 0, questDaysPerChest: 3 });
    assert.equal(m.href, "habits");
    assert.match(m.label, /закрой 3/);
    assert.equal(m.nextIn, 3);
  });

  test("one day left → закрой день", () => {
    const m = buildChestProgressChip({ questDayCount: 2, questDaysPerChest: 3 });
    assert.equal(m.label, "Сундук · закрой день");
    assert.equal(m.href, "habits");
    assert.equal(m.nextIn, 1);
  });

  test("after a chest cycle, next needs full per days", () => {
    const m = buildChestProgressChip({ questDayCount: 3, questDaysPerChest: 3 });
    assert.equal(m.nextIn, 3);
    assert.match(m.label, /ещё 3/);
    assert.equal(m.href, "rewards");
  });

  test("mid progress shows remaining days", () => {
    const m = buildChestProgressChip({ questDayCount: 1, questDaysPerChest: 3 });
    assert.equal(m.nextIn, 2);
    assert.match(m.label, /ещё 2/);
  });
});
