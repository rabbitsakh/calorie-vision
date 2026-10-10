import assert from "node:assert/strict";
import { test } from "node:test";
import { buildMorningTodayBrief, streakOwnsMorning } from "./morning-today.ts";

const base = {
  selectedIsToday: true,
  hour: 8,
  loggedToday: false,
  calories: 0,
  calorieTarget: 2000,
  streakOwnsMorning: false,
  gymDoneToday: false,
  routinesToday: [] as Array<{ name: string; muscleLabels: string[] }>,
};

test("streakOwnsMorning mirrors motivation soft-return gate", () => {
  assert.equal(
    streakOwnsMorning({
      yesterdayEmpty: true,
      canFreezeYesterday: false,
      streakAtRisk: false,
    }),
    true,
  );
  assert.equal(
    streakOwnsMorning({
      yesterdayEmpty: false,
      canFreezeYesterday: false,
      streakAtRisk: false,
    }),
    false,
  );
});

test("empty morning + rest day", () => {
  const brief = buildMorningTodayBrief(base);
  assert.ok(brief);
  assert.equal(brief.eyebrow, "Что сегодня");
  assert.match(brief.line, /Первый приём/);
  assert.match(brief.line, /Отдых/);
  assert.equal(brief.cta, null);
});

test("planned gym gets CTA", () => {
  const brief = buildMorningTodayBrief({
    ...base,
    routinesToday: [{ name: "Грудь", muscleLabels: ["Грудь", "Трицепс"] }],
  });
  assert.ok(brief);
  assert.match(brief.line, /Грудь/);
  assert.equal(brief.cta?.label, "В зал");
  assert.equal(brief.cta?.href, "/workouts");
});

test("after logging shows remaining kcal", () => {
  const brief = buildMorningTodayBrief({
    ...base,
    loggedToday: true,
    calories: 600,
    routinesToday: [{ name: "Ноги", muscleLabels: ["Ноги"] }],
  });
  assert.ok(brief);
  assert.match(brief.line, /Ещё ~1400 ккал/);
  assert.match(brief.line, /Ноги/);
});

test("hidden outside morning and when streak owns slot", () => {
  assert.equal(buildMorningTodayBrief({ ...base, hour: 14 }), null);
  assert.equal(buildMorningTodayBrief({ ...base, streakOwnsMorning: true }), null);
  assert.equal(buildMorningTodayBrief({ ...base, selectedIsToday: false }), null);
});

test("steps aside after meal + gym done", () => {
  assert.equal(
    buildMorningTodayBrief({
      ...base,
      loggedToday: true,
      calories: 900,
      gymDoneToday: true,
      routinesToday: [],
    }),
    null,
  );
});
