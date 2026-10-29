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

test("buildMomentHero: morning uses the morning brief and its gym CTA", () => {
  const m = buildMomentHero({
    ...base,
    hour: 7,
    morning: { eyebrow: "Что сегодня", line: "Первый приём — и день начат · Грудь", cta: { label: "В зал", href: "/workouts" } },
  });
  assert.equal(m?.phase, "morning");
  assert.equal(m?.title, "Первый приём — и день начат · Грудь");
  assert.equal(m?.cta?.label, "В зал");
  assert.equal(buildMomentHero({ ...base, hour: 7, morning: null }), null);
});

test("buildMomentHero: daytime shows remaining kcal, protein and water", () => {
  const m = buildMomentHero(base);
  assert.equal(m?.phase, "day");
  assert.equal(m?.title, "Осталось ~1240 ккал");
  assert.equal(m?.line, "белок: ещё 48 г · вода 0,9 из 2 л");
  assert.deepEqual(m?.cta, { label: "Добавить", action: "food" });
});

test("buildMomentHero: daytime over target", () => {
  assert.equal(buildMomentHero({ ...base, calories: 2300 })?.title, "+200 ккал сверх цели");
  assert.equal(buildMomentHero({ ...base, calories: 2080 })?.title, "Калории в норме");
});

test("buildMomentHero: evening is a day summary with gym and streak", () => {
  const m = buildMomentHero({ ...base, hour: 20, calories: 1850, protein: 110, gymDoneToday: true });
  assert.equal(m?.phase, "evening");
  assert.equal(m?.title, "1850 из 2100 ккал");
  assert.equal(m?.line, "белок 110/120 г · вода 0,9 из 2 л · зал ✓ · серия 5 дн.");
});

test("buildMomentHero: empty day asks for one entry", () => {
  const m = buildMomentHero({ ...base, logged: false, calories: 0 });
  assert.equal(m?.title, "День пока без записей");
  assert.deepEqual(m?.cta, { label: "Добавить", action: "food" });
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
