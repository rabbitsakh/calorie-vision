import assert from "node:assert/strict";
import test from "node:test";
import {
  GYM_START_LABELS,
  gymBigStartLabel,
  resolveGymStartChrome,
  resolveTodayPrimary,
} from "@/lib/workouts/today-primary";

const idle = {
  hasActive: false,
  draftCount: 0,
  finishedCount: 0,
  plannedCount: 0,
  firstEmpty: false,
};

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

test("resolveTodayPrimary free workout stays primary when a plan exists", () => {
  assert.equal(
    resolveTodayPrimary({
      ...idle,
      plannedCount: 1,
    }),
    "blank_start",
  );
});

test("resolveTodayPrimary idle day without a plan is a free workout", () => {
  assert.equal(resolveTodayPrimary(idle), "blank_start");
});

test("resolveTodayPrimary past session does not replace the free workout", () => {
  assert.equal(
    resolveTodayPrimary({
      ...idle,
      hasRepeat: true,
    }),
    "blank_start",
  );
});

test("resolveTodayPrimary plan plus past session is still a free workout", () => {
  assert.equal(
    resolveTodayPrimary({
      ...idle,
      plannedCount: 2,
      hasRepeat: true,
    }),
    "blank_start",
  );
});

test("resolveTodayPrimary first empty is blank_start", () => {
  assert.equal(
    resolveTodayPrimary({
      ...idle,
      firstEmpty: true,
    }),
    "blank_start",
  );
});

test("resolveTodayPrimary first empty beats hasRepeat", () => {
  assert.equal(
    resolveTodayPrimary({
      ...idle,
      firstEmpty: true,
      hasRepeat: true,
    }),
    "blank_start",
  );
});

test("resolveTodayPrimary finished today stays finished even with a plan", () => {
  assert.equal(
    resolveTodayPrimary({
      ...idle,
      finishedCount: 1,
      plannedCount: 1,
      hasRepeat: true,
    }),
    "finished",
  );
});

test("gym big start label is the free workout, including another today", () => {
  assert.equal(gymBigStartLabel(false), GYM_START_LABELS.free);
  assert.equal(gymBigStartLabel(false), "Начать тренировку");
  assert.equal(gymBigStartLabel(true), "Начать ещё одну");
  assert.equal(GYM_START_LABELS.plan, "По плану");
  assert.equal(GYM_START_LABELS.repeat, "Повторить прошлую");
});

test("big start is shown on a planned day and always starts a free workout", () => {
  const chrome = resolveGymStartChrome({
    hasActive: false,
    draftCount: 0,
    plannedCount: 1,
    hasRepeat: true,
  });
  assert.equal(chrome.showBigStart, true);
  assert.equal(chrome.bigStart, "blank");
  assert.equal(chrome.showPlan, true);
  assert.equal(chrome.showRepeat, true);
});

test("plan secondary is hidden when today has no template", () => {
  const chrome = resolveGymStartChrome({
    hasActive: false,
    draftCount: 0,
    plannedCount: 0,
    hasRepeat: false,
  });
  assert.equal(chrome.showBigStart, true);
  assert.equal(chrome.bigStart, "blank");
  assert.equal(chrome.showPlan, false);
  assert.equal(chrome.showRepeat, false);
});

test("repeat secondary is shown only when a past session can be copied", () => {
  const without = resolveGymStartChrome({
    hasActive: false,
    draftCount: 0,
    plannedCount: 0,
    hasRepeat: false,
  });
  const withRepeat = resolveGymStartChrome({
    hasActive: false,
    draftCount: 0,
    plannedCount: 0,
    hasRepeat: true,
  });
  assert.equal(without.showRepeat, false);
  assert.equal(without.bigStart, "blank");
  assert.equal(withRepeat.showRepeat, true);
  assert.equal(withRepeat.bigStart, "blank");
  assert.equal(withRepeat.showPlan, false);
});

test("big start is hidden while a session is active or a draft is open", () => {
  const active = resolveGymStartChrome({
    hasActive: true,
    draftCount: 0,
    plannedCount: 1,
    hasRepeat: true,
  });
  const draft = resolveGymStartChrome({
    hasActive: false,
    draftCount: 1,
    plannedCount: 1,
    hasRepeat: true,
  });
  assert.equal(active.showBigStart, false);
  assert.equal(active.showPlan, false);
  assert.equal(active.showRepeat, false);
  assert.equal(active.bigStart, "blank");
  assert.equal(draft.showBigStart, false);
  assert.equal(draft.showPlan, false);
  assert.equal(draft.showRepeat, false);
});
