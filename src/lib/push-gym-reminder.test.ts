import assert from "node:assert/strict";
import { test } from "node:test";
import {
  GYM_REMINDER_COPY_POOL,
  isInGymQuietWindow,
  pickCopyPoolIndex,
  pickGymReminderCopy,
  shouldSkipGymReminder,
} from "./push-gym-reminder.ts";

test("shouldSkipGymReminder when active workout", () => {
  assert.equal(shouldSkipGymReminder({ hasActiveWorkoutToday: true }), true);
});

test("shouldSkipGymReminder when finished today", () => {
  assert.equal(shouldSkipGymReminder({ hasFinishedWorkoutToday: true }), true);
});

test("shouldSkipGymReminder when sets already logged", () => {
  assert.equal(shouldSkipGymReminder({ hasLoggedWorkoutSetToday: true }), true);
});

test("shouldSkipGymReminder false when no workout progress", () => {
  assert.equal(shouldSkipGymReminder({}), false);
  assert.equal(
    shouldSkipGymReminder({
      hasActiveWorkoutToday: false,
      hasFinishedWorkoutToday: false,
      hasLoggedWorkoutSetToday: false,
    }),
    false,
  );
});

test("pickGymReminderCopy rotates by day for same user", () => {
  const a = pickGymReminderCopy({ userId: "u1", today: "2026-10-27" });
  const b = pickGymReminderCopy({ userId: "u1", today: "2026-10-28" });
  // Not guaranteed different, but pool index must be in range and stable.
  assert.ok(GYM_REMINDER_COPY_POOL.some((c) => c.title === a.title));
  assert.ok(GYM_REMINDER_COPY_POOL.some((c) => c.title === b.title));
  assert.equal(
    pickCopyPoolIndex("u1", "gym", "2026-10-27", 6),
    pickCopyPoolIndex("u1", "gym", "2026-10-27", 6),
  );
});

test("pickGymReminderCopy slot override", () => {
  const c = pickGymReminderCopy({ today: "2026-10-27", slot: 0 });
  assert.deepEqual(c, GYM_REMINDER_COPY_POOL[0]);
});

test("gym copy does not tell to continue mid-session", () => {
  for (const c of GYM_REMINDER_COPY_POOL) {
    assert.doesNotMatch(c.body, /продолж/i);
  }
});

test("isInGymQuietWindow: open clock started recently mutes nudges", () => {
  const now = new Date("2026-10-29T08:00:00Z");
  assert.equal(
    isInGymQuietWindow([{ startedAt: "2026-10-29T07:10:00Z", endedAt: null }], now),
    true,
  );
  assert.equal(
    isInGymQuietWindow([{ startedAt: "2026-10-29T07:10:00Z", endedAt: "2026-10-29T07:55:00Z" }], now),
    false,
  );
  assert.equal(
    isInGymQuietWindow([{ startedAt: "2026-10-29T03:00:00Z", endedAt: null }], now),
    false,
  );
  assert.equal(isInGymQuietWindow([{ startedAt: null, endedAt: null }], now), false);
});
