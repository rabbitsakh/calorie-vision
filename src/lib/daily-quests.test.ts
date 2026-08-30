import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { computeDailyQuests } from "./daily-quests.ts";

describe("daily-quests", () => {
  test("both incomplete by default", () => {
    const { quests, allDone } = computeDailyQuests({
      mealCount: 0,
      waterMl: 0,
      waterTarget: 2000,
    });
    assert.equal(allDone, false);
    assert.equal(quests.every((q) => !q.done), true);
  });

  test("allDone when meal logged and water met", () => {
    const { allDone } = computeDailyQuests({
      mealCount: 2,
      waterMl: 2000,
      waterTarget: 2000,
    });
    assert.equal(allDone, true);
  });
});
