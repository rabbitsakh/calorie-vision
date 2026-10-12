import assert from "node:assert/strict";
import test from "node:test";
import { resolveTodayPrimary } from "@/lib/workouts/today-primary";

test("resolveTodayPrimary prefers active continue", () => {
  assert.equal(
    resolveTodayPrimary({
      hasActive: true,
      draftCount: 1,
      finishedCount: 0,
      plannedCount: 2,
      firstEmpty: false,
    }),
    "continue",
  );
});

test("resolveTodayPrimary prefers draft over plan", () => {
  assert.equal(
    resolveTodayPrimary({
      hasActive: false,
      draftCount: 1,
      finishedCount: 0,
      plannedCount: 1,
      firstEmpty: false,
    }),
    "open_draft",
  );
});

test("resolveTodayPrimary prefers plan over blank", () => {
  assert.equal(
    resolveTodayPrimary({
      hasActive: false,
      draftCount: 0,
      finishedCount: 0,
      plannedCount: 1,
      firstEmpty: false,
    }),
    "start_plan",
  );
});

test("resolveTodayPrimary empty plan is rest", () => {
  assert.equal(
    resolveTodayPrimary({
      hasActive: false,
      draftCount: 0,
      finishedCount: 0,
      plannedCount: 0,
      firstEmpty: false,
    }),
    "rest",
  );
});

test("resolveTodayPrimary first empty is blank_start", () => {
  assert.equal(
    resolveTodayPrimary({
      hasActive: false,
      draftCount: 0,
      finishedCount: 0,
      plannedCount: 0,
      firstEmpty: true,
    }),
    "blank_start",
  );
});
