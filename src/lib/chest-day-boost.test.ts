import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { GRANT_NEW_QUEST_DAY_BOOST, questDayBoostSourceKey } from "./chest-day-boost.ts";

describe("chest-day-boost", () => {
  test("boost sourceKey is stable per date", () => {
    assert.equal(questDayBoostSourceKey("2026-10-25"), "quest-day-boost:2026-10-25");
  });

  test("новым дням бонусный зачёт не выдаётся", () => {
    assert.equal(GRANT_NEW_QUEST_DAY_BOOST, false);
  });
});
