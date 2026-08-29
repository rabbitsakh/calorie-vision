import assert from "node:assert/strict";
import { test } from "node:test";
import {
  challengeOptionsForWeek,
  daysLeftInChallengeWeek,
} from "./challenges.ts";

test("daysLeftInChallengeWeek is 7 on Monday", () => {
  // 2026-08-24 is Monday
  assert.equal(daysLeftInChallengeWeek("2026-08-24", "2026-08-24"), 7);
});

test("daysLeftInChallengeWeek shrinks toward Sunday", () => {
  assert.equal(daysLeftInChallengeWeek("2026-08-26", "2026-08-24"), 5); // Wed
  assert.equal(daysLeftInChallengeWeek("2026-08-30", "2026-08-24"), 1); // Sun
});

test("challengeOptionsForWeek marks 7-day goals tight mid-week", () => {
  const options = challengeOptionsForWeek("2026-08-28", "2026-08-24"); // Fri → 3 days left
  const breakfast = options.find((o) => o.key === "breakfast_7");
  const water5 = options.find((o) => o.key === "water_5");
  assert.equal(breakfast?.tight, true);
  assert.equal(water5?.tight, true); // 5 > 3
  const log5 = options.find((o) => o.key === "log_5");
  assert.equal(log5?.daysLeft, 3);
});

test("challengeOptionsForWeek is loose on Monday", () => {
  const options = challengeOptionsForWeek("2026-08-24", "2026-08-24");
  assert.ok(options.every((o) => o.tight === false));
});
