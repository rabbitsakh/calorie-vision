import assert from "node:assert/strict";
import { test } from "node:test";
import {
  shouldShowMotivationSoftReturn,
  shouldShowMotivationTip,
} from "./motivation-tip-gate.ts";

test("soft return tip is suppressed when StreakNudge owns the morning", () => {
  assert.equal(
    shouldShowMotivationSoftReturn({
      loggedToday: false,
      yesterdayEmpty: true,
      canFreezeYesterday: false,
      streakAtRisk: false,
      hour: 9,
    }),
    false,
  );
  assert.equal(
    shouldShowMotivationSoftReturn({
      loggedToday: false,
      yesterdayEmpty: false,
      canFreezeYesterday: true,
      streakAtRisk: false,
      hour: 9,
    }),
    false,
  );
});

test("tip still shows after lunch once the user logged", () => {
  assert.equal(
    shouldShowMotivationTip({
      selectedIsToday: true,
      loggedToday: true,
      yesterdayEmpty: true,
      canFreezeYesterday: false,
      streakAtRisk: false,
      hour: 14,
    }),
    true,
  );
});
