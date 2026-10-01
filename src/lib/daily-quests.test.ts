import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { computeDailyQuests } from "./daily-quests.ts";

describe("daily-quests", () => {
  test("required incomplete by default", () => {
    const { quests, allDone } = computeDailyQuests({
      mealCount: 0,
      waterMl: 0,
      waterTarget: 2000,
    });
    assert.equal(allDone, false);
    assert.equal(quests.find((q) => q.id === "log_meal")?.done, false);
    assert.equal(quests.find((q) => q.id === "drink_water")?.done, false);
    assert.equal(quests.find((q) => q.id === "gym_today")?.done, false);
  });

  test("allDone when meal logged and water met — gym optional", () => {
    const { allDone, quests } = computeDailyQuests({
      mealCount: 2,
      waterMl: 2000,
      waterTarget: 2000,
      gymSessionCount: 0,
    });
    assert.equal(allDone, true);
    assert.equal(quests.find((q) => q.id === "gym_today")?.done, false);
  });

  test("gym_today credits when session exists", () => {
    const { quests, allDone } = computeDailyQuests({
      mealCount: 1,
      waterMl: 2000,
      waterTarget: 2000,
      gymSessionCount: 1,
    });
    assert.equal(allDone, true);
    assert.equal(quests.find((q) => q.id === "gym_today")?.done, true);
  });
});
