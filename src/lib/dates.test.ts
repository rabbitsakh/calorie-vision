import assert from "node:assert/strict";
import { test } from "node:test";
import {
  dateRangeEnding,
  formatDateWords,
  formatYearMonth,
  getMonthGrid,
  isDateKey,
  monthDateRange,
  parseYearMonth,
  shiftDateKey,
  shiftYearMonth,
} from "./dates.ts";

test("builds a Monday-first grid for August 2026", () => {
  const grid = getMonthGrid(2026, 7);
  assert.equal(grid.length % 7, 0);
  assert.equal(grid[0], null);
  assert.equal(grid[4], null);
  assert.equal(grid[5], "2026-08-01");
  assert.equal(grid[35], "2026-08-31");
});

test("parses and shifts year-month values", () => {
  assert.deepEqual(parseYearMonth("2026-08"), { year: 2026, monthIndex: 7 });
  assert.equal(formatYearMonth(2026, 7), "2026-08");
  assert.deepEqual(shiftYearMonth(2026, 0, -1), { year: 2025, monthIndex: 11 });
  assert.deepEqual(monthDateRange(2026, 7), { start: "2026-08-01", end: "2026-08-31" });
});

test("validates YYYY-MM-DD date keys", () => {
  assert.equal(isDateKey("2026-09-01"), true);
  assert.equal(isDateKey("2026-02-31"), false);
  assert.equal(isDateKey("01.09.2026"), false);
});

test("formats stored date keys as Russian words", () => {
  assert.equal(formatDateWords("2026-09-01"), "1 сентября 2026 г.");
});

test("shifts date keys and builds inclusive ranges", () => {
  assert.equal(shiftDateKey("2026-09-01", -1), "2026-08-31");
  assert.equal(shiftDateKey("2026-09-01", 1), "2026-09-02");
  assert.deepEqual(dateRangeEnding("2026-09-03", 3), ["2026-09-01", "2026-09-02", "2026-09-03"]);
});
