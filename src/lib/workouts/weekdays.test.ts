import assert from "node:assert/strict";
import { test } from "node:test";
import {
  jsDateToPlanWeekday,
  parsePlanLabel,
  parseWeekdays,
  planWeekdayFromDateKey,
} from "./weekdays.ts";

test("parseWeekdays", () => {
  assert.deepEqual(parseWeekdays([0, 2, 2, 9, "4"]), [0, 2, 4]);
  assert.deepEqual(parseWeekdays(null), []);
});

test("planWeekdayFromDateKey Monday=0", () => {
  // 2026-09-21 is Monday
  assert.equal(planWeekdayFromDateKey("2026-09-21"), 0);
  // 2026-09-27 is Sunday
  assert.equal(planWeekdayFromDateKey("2026-09-27"), 6);
});

test("jsDateToPlanWeekday", () => {
  assert.equal(jsDateToPlanWeekday(new Date("2026-09-21T12:00:00")), 0);
});

test("parsePlanLabel", () => {
  assert.equal(parsePlanLabel("a"), "A");
  assert.equal(parsePlanLabel(""), null);
});
