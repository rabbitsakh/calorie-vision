import assert from "node:assert/strict";
import { test } from "node:test";
import { buildMomentHero, pickSoftStep, type MomentHeroInput, type SoftStepInput } from "./moment-hero.ts";

const base: MomentHeroInput = {
  selectedIsToday: true,
  hour: 14,
  gymLive: false,
  gymLiveLabel: null,
  gymDoneToday: false,
  morning: null,
  logged: true,
  calories: 860,
  calorieTarget: 2100,
  protein: 72,
  proteinTarget: 120,
  waterMl: 900,
  waterTarget: 2000,
  streak: 5,
  softStep: null,
};

const step: SoftStepInput = {
  hour: 14,
  logged: true,
  hasTarget: true,
  protein: 80,
  proteinTarget: 120,
  waterMl: 1500,
  waterTarget: 2000,
  postWorkout: false,
  weekNudge: null,
  daysLoggedThisWeek: 0,
  weekNudgeDismissed: false,
};

test("buildMomentHero: not today → nothing", () => {
  assert.equal(buildMomentHero({ ...base, selectedIsToday: false }), null);
});

test("buildMomentHero: live gym wins over any time of day", () => {
  const m = buildMomentHero({ ...base, hour: 8, gymLive: true, gymLiveLabel: "Грудь · Трицепс" });
  assert.equal(m?.phase, "gym");
  assert.equal(m?.title, "Тренировка идёт");
  assert.equal(m?.line, "Грудь · Трицепс");
  assert.deepEqual(m?.cta, { label: "К подходам", href: "/workouts" });
});

test("buildMomentHero: morning with a plan → routine name big, start CTA", () => {
  const morning = { eyebrow: "Что сегодня", line: "Первый приём — и день начат · Грудь", cta: { label: "В зал", href: "/workouts" } };
  const m = buildMomentHero({
    ...base,
    hour: 7,
    logged: false,
    morning,
    routine: { name: "Грудь + трицепс", exerciseCount: 5 },
  });
  assert.equal(m?.phase, "morning");
  assert.equal(m?.tone, "dark");
  assert.equal(m?.title, "Грудь + трицепс");
  assert.equal(m?.line, "5 упражнений · ~55 мин");
  assert.deepEqual(m?.cta, { label: "Начать тренировку", href: "/workouts" });
  const noPlan = buildMomentHero({ ...base, hour: 7, morning });
  assert.equal(noPlan?.title, morning.line);
  assert.equal(noPlan?.cta?.label, "В зал");
});

test("buildMomentHero: today always has a hero (morning brief hidden → food card)", () => {
  const m = buildMomentHero({ ...base, hour: 7, morning: null });
  assert.equal(m?.tone, "soft");
  assert.equal(m?.title, "Осталось 1\u00a0240 ккал");
});

test("buildMomentHero: daytime shows remaining kcal and Б/Ж/У bars", () => {
  const m = buildMomentHero({ ...base, fat: 30, fatTarget: 70, carbs: 90, carbsTarget: 250 });
  assert.equal(m?.phase, "day");
  assert.equal(m?.eyebrow, "Сейчас · обед");
  assert.equal(m?.title, "Осталось 1\u00a0240 ккал");
  assert.equal(m?.line, "вода 0,9 из 2 л");
  assert.deepEqual(
    m?.macros?.map((r) => [r.label, r.value, r.target]),
    [["Б", 72, 120], ["Ж", 30, 70], ["У", 90, 250]],
  );
  assert.deepEqual(m?.cta, { label: "Добавить еду", action: "food" });
  assert.equal(
    buildMomentHero({ ...base, gymDoneToday: true })?.line,
    "после зала добери ~48 г белка · вода 0,9 из 2 л · зал ✓",
  );
});

test("buildMomentHero: daytime over target", () => {
  assert.equal(buildMomentHero({ ...base, calories: 2300 })?.title, "+200 ккал сверх цели");
  assert.equal(buildMomentHero({ ...base, calories: 2080 })?.title, "Калории в норме");
});

test("buildMomentHero: evening ring + checklist", () => {
  const m = buildMomentHero({
    ...base,
    hour: 21,
    calories: 2020,
    protein: 118,
    mealCount: 4,
    gymDoneToday: true,
    tomorrowPlanLabel: "Ноги",
  });
  assert.equal(m?.phase, "evening");
  assert.equal(m?.title, "День в цели");
  assert.equal(m?.ringPct, 96);
  assert.equal(m?.line, "2\u00a0020 из 2\u00a0100 ккал · серия 5 дн.");
  assert.equal(m?.hint, "Завтра: Ноги");
  assert.deepEqual(m?.cta, { label: "Закрыть день · открыть сундук", action: "chest" });
  assert.deepEqual(
    m?.checklist?.map((c) => [c.label, c.done, c.value]),
    [
      ["Еда", true, "4 приёма записано"],
      ["Белок", true, "118 / 120 г"],
      ["Вода", false, "0,9 / 2 л"],
      ["Зал", true, "сделан"],
    ],
  );
  assert.equal(buildMomentHero({ ...base, hour: 21, calories: 1500 })?.title, "День почти собран");
});

test("buildMomentHero: empty day asks for one entry", () => {
  const m = buildMomentHero({ ...base, logged: false, calories: 0 });
  assert.equal(m?.title, "День пока без записей");
  assert.deepEqual(m?.cta, { label: "Сфоткать еду", action: "camera" });
});

test("buildMomentHero: soft step becomes hint + CTA", () => {
  const m = buildMomentHero({
    ...base,
    softStep: { label: "Воды пока мало — один стакан уже поможет", actionLabel: "Вода", action: "water" },
  });
  assert.equal(m?.hint, "Воды пока мало — один стакан уже поможет");
  assert.deepEqual(m?.cta, { label: "Вода", action: "water" });
});

test("pickSoftStep: weight first when no calorie target", () => {
  assert.equal(pickSoftStep({ ...step, hasTarget: false })?.action, "weight");
});

test("pickSoftStep: post-workout protein", () => {
  assert.equal(pickSoftStep({ ...step, postWorkout: true, protein: 40 })?.label, "После тренировки — доберите белок");
  assert.equal(pickSoftStep({ ...step, postWorkout: true, logged: false })?.action, "food");
});

test("pickSoftStep: low water after 11", () => {
  assert.equal(pickSoftStep({ ...step, waterMl: 300 })?.action, "water");
  assert.equal(pickSoftStep({ ...step, hour: 10, waterMl: 300 }), null);
});

test("pickSoftStep: nothing to nudge", () => {
  assert.equal(pickSoftStep(step), null);
});
