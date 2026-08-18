import assert from "node:assert/strict";
import { test } from "node:test";
import {
  computeWeightChangeKg,
  groupWeightEntriesByDate,
  latestWeightByDate,
  sortWeightEntriesNewestFirst,
} from "./weight-entries.ts";

test("orders by calendar date descending, then measuredAt", () => {
  const entries = [
    {
      id: "old-day",
      date: "2026-08-17",
      measuredAt: "2026-08-18T19:33:00.000Z",
      weightKg: 141.3,
    },
    {
      id: "new-day-late",
      date: "2026-08-18",
      measuredAt: "2026-08-18T16:34:00.000Z",
      weightKg: 137,
    },
    {
      id: "new-day-early",
      date: "2026-08-18",
      measuredAt: "2026-08-18T16:31:00.000Z",
      weightKg: 139,
    },
  ];
  const sorted = sortWeightEntriesNewestFirst(entries);
  assert.deepEqual(sorted.map((e) => e.id), ["new-day-late", "new-day-early", "old-day"]);
});

test("orders by measuredAt within the same calendar day", () => {
  const entries = [
    { id: "a", measuredAt: "2024-08-16T16:32:00.000Z", date: "2024-08-16", weightKg: 138 },
    { id: "b", measuredAt: "2024-08-16T16:34:00.000Z", date: "2024-08-16", weightKg: 139 },
    { id: "c", measuredAt: "2024-08-18T19:13:00.000Z", date: "2024-08-18", weightKg: 140.4 },
  ];
  const sorted = sortWeightEntriesNewestFirst(entries);
  assert.deepEqual(sorted.map((e) => e.id), ["c", "b", "a"]);
});

test("uses id as tie-breaker when date and measuredAt are equal", () => {
  const entries = [
    { id: "a", measuredAt: "2024-08-16T16:32:00.000Z", date: "2024-08-16", weightKg: 138 },
    { id: "b", measuredAt: "2024-08-16T16:32:00.000Z", date: "2024-08-16", weightKg: 139 },
  ];
  const sorted = sortWeightEntriesNewestFirst(entries);
  assert.deepEqual(sorted.map((e) => e.id), ["b", "a"]);
});

test("groups by date with newest calendar day first", () => {
  const entries = [
    {
      id: "old-day",
      date: "2026-08-17",
      measuredAt: "2026-08-18T19:33:00.000Z",
      weightKg: 141.3,
    },
    {
      id: "new-day-late",
      date: "2026-08-18",
      measuredAt: "2026-08-18T16:34:00.000Z",
      weightKg: 137,
    },
    {
      id: "new-day-early",
      date: "2026-08-18",
      measuredAt: "2026-08-18T16:31:00.000Z",
      weightKg: 139,
    },
  ];
  const grouped = groupWeightEntriesByDate(entries);
  assert.deepEqual(grouped.map((g) => g.date), ["2026-08-18", "2026-08-17"]);
  assert.deepEqual(grouped[0].items.map((e) => e.id), ["new-day-late", "new-day-early"]);
});

test("returns change from oldest to newest measurement", () => {
  const oldest = { id: "a", weightKg: 138 };
  const newest = { id: "c", weightKg: 140.4 };
  assert.equal(computeWeightChangeKg(oldest, newest), 2.4);
});

test("returns null weight change for a single entry", () => {
  const only = { id: "a", weightKg: 80 };
  assert.equal(computeWeightChangeKg(only, only), null);
});

test("keeps the latest measurement per day for stats", () => {
  const entries = [
    { id: "a", measuredAt: "2024-08-16T16:32:00.000Z", date: "2024-08-16", weightKg: 138 },
    { id: "b", measuredAt: "2024-08-16T16:34:00.000Z", date: "2024-08-16", weightKg: 139 },
  ];
  const map = latestWeightByDate(entries);
  assert.equal(map.get("2024-08-16"), 139);
});
