import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { questDayBoostSourceKey } from "./chest-day-boost.ts";

describe("chest-day-boost", () => {
  test("boost sourceKey is stable per date", () => {
    assert.equal(questDayBoostSourceKey("2026-10-25"), "quest-day-boost:2026-10-25");
  });
});
