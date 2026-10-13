import assert from "node:assert/strict";
import { test } from "node:test";
import { buildAssistantDayVoice } from "./assistant-day-voice.ts";
import type { AssistantContextSnapshot } from "./admin-assistant.ts";

const base: AssistantContextSnapshot = {
  date: "2026-10-13",
  today: "2026-10-13",
  calories: 0,
  targetCalories: 2000,
  remainingCalories: 2000,
  protein: 0,
  targetProtein: 120,
  waterMl: 0,
  waterTargetMl: 2000,
  weightKg: 70,
  streakDays: 3,
  challenge: null,
  recentWorkoutLabel: null,
};

test("morning empty day → photo", () => {
  const v = buildAssistantDayVoice({ hour: 8, isToday: true, snapshot: base });
  assert.ok(v);
  assert.equal(v?.openPhoto, true);
});

test("evening empty day → text draft", () => {
  const v = buildAssistantDayVoice({ hour: 19, isToday: true, snapshot: base });
  assert.ok(v);
  assert.match(v?.draft ?? "", /ужин/i);
});

test("quiet when day is full and water ok", () => {
  const v = buildAssistantDayVoice({
    hour: 15,
    isToday: true,
    snapshot: {
      ...base,
      calories: 1600,
      remainingCalories: 400,
      waterMl: 1500,
    },
  });
  assert.equal(v, null);
});

test("not today → null", () => {
  assert.equal(
    buildAssistantDayVoice({ hour: 8, isToday: false, snapshot: base }),
    null,
  );
});
