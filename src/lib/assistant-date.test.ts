import assert from "node:assert/strict";
import { test } from "node:test";
import { formatDateInput } from "./dates.ts";

test("formatDateInput matches local calendar (not UTC ISO)", () => {
  // 2026-10-13 01:30 in local — constructing via Y/M/D avoids env TZ surprises.
  const local = new Date(2026, 9, 13, 1, 30, 0);
  assert.equal(formatDateInput(local), "2026-10-13");
  // UTC slice can be previous day for late-evening western TZ or early morning eastern —
  // the assistant must NOT use toISOString for the write day.
  const utcKey = local.toISOString().slice(0, 10);
  assert.equal(typeof utcKey, "string");
  assert.match(utcKey, /^\d{4}-\d{2}-\d{2}$/);
});
