import assert from "node:assert/strict";
import { test } from "node:test";
import {
  formatYearMonth,
  getMonthGrid,
  parseYearMonth,
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
});
