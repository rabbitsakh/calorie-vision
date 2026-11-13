import assert from "node:assert/strict";
import { test } from "node:test";
import {
  buildMomentHero,
  formatWaterProgress,
  pickSoftStep,
  resolveEveningDay,
  waterMeetsChest,
  type EveningChestSnapshot,
  type MomentHeroInput,
  type SoftStepInput,
} from "./moment-hero.ts";

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
  assert.equal(m?.title, "Осталось 1\u00a0240 из 2\u00a0100 ккал");
});

test("buildMomentHero: daytime shows remaining of the target and full macro names", () => {
  const m = buildMomentHero({ ...base, fat: 30, fatTarget: 70, carbs: 90, carbsTarget: 250 });
  assert.equal(m?.phase, "day");
  assert.equal(m?.eyebrow, "Сейчас · обед");
  assert.equal(m?.title, "Осталось 1\u00a0240 из 2\u00a0100 ккал");
  assert.deepEqual(m?.kcal, { eaten: 860, target: 2100 });
  assert.equal(m?.line, null);
  assert.equal(m?.proteinNote, null);
  assert.deepEqual(m?.chips, [{ kind: "water", title: "Вода", detail: "0,9 из 2 л", actionLabel: "Стакан" }]);
  assert.deepEqual(
    m?.macros?.map((r) => [r.label, r.value, r.target]),
    [
      ["Белки", 72, 120],
      ["Жиры", 30, 70],
      ["Углеводы", 90, 250],
    ],
  );
  assert.deepEqual(m?.cta, { label: "Добавить еду", action: "food" });
  const afterGym = buildMomentHero({ ...base, gymDoneToday: true });
  assert.equal(afterGym?.proteinNote, "После зала ещё 48 г белка");
  assert.equal(afterGym?.line, null);
  assert.deepEqual(
    afterGym?.chips?.map((c) => c.kind),
    ["water", "gym"],
  );
  assert.equal(
    buildMomentHero({ ...base, gymDoneToday: true, protein: 118 })?.line,
    "комбо-день · тренировка и белок",
  );
});

test("buildMomentHero: protein hint is not repeated under the gym note", () => {
  const m = buildMomentHero({
    ...base,
    gymDoneToday: true,
    softStep: { label: "После тренировки — доберите белок", actionLabel: "Добавить", action: "food" },
  });
  assert.equal(m?.proteinNote, "После зала ещё 48 г белка");
  assert.equal(m?.hint, null);
  assert.equal(m?.title, "Осталось 1\u00a0240 из 2\u00a0100 ккал");
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
  assert.equal(m?.title, "Записано 96% цели");
  assert.equal(m?.ringPct, 96);
  assert.equal(m?.line, "2\u00a0020 из 2\u00a0100 ккал · серия 5 дн.");
  assert.equal(m?.hint, "Завтра: Ноги");
  assert.deepEqual(m?.cta, { label: "Долить воду до нормы", action: "water" });
  assert.equal(
    m?.checklistNote,
    "Еда и вода — один зачёт. Тренировка с подходами — ещё один, один раз за день.",
  );
  assert.deepEqual(
    m?.checklist?.map((c) => [c.label, c.done, c.value]),
    [
      ["Еда", true, "4 приёма записано"],
      ["Белок", true, "118 / 120 г"],
      ["Вода", false, "0,9 из 2 л"],
      ["Зал", true, "комбо-день"],
    ],
  );
  assert.equal(buildMomentHero({ ...base, hour: 21, calories: 1500 })?.title, "Записано 71% цели");
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

const calmChest = (
  patch: Partial<EveningChestSnapshot> & Pick<EveningChestSnapshot, "state">,
): EveningChestSnapshot => ({
  questDayCount: 0,
  openedQuestChests: 0,
  todayMarked: false,
  per: 3,
  head: null,
  ...patch,
});

test("вечер: нет записей — сфоткать, без обещания сундука", () => {
  const day = resolveEveningDay({
    logged: false,
    waterMl: 0,
    waterTarget: 2000,
    calories: 0,
    calorieTarget: 2018,
    chest: null,
  });
  assert.equal(day.title, "День пока без записей");
  assert.deepEqual(day.cta, { label: "Сфоткать еду", action: "camera" });
});

test("вечер: еда без воды — честный процент и кнопка воды", () => {
  const day = resolveEveningDay({
    logged: true,
    waterMl: 1990,
    waterTarget: 2000,
    calories: 400,
    calorieTarget: 2018,
    chest: calmChest({ state: "filling", questDayCount: 1, todayMarked: false }),
  });
  assert.equal(day.title, "Записано 20% цели");
  assert.deepEqual(day.cta, { label: "Долить воду до нормы", action: "water" });
  assert.equal(waterMeetsChest(1990, 2000), false);
  assert.equal(formatWaterProgress(1990, 2000), "1,9 из 2 л");
  assert.equal(formatWaterProgress(2000, 2000), "2 из 2 л");
});

test("вечер: вода без еды", () => {
  const day = resolveEveningDay({
    logged: false,
    waterMl: 2000,
    waterTarget: 2000,
    calories: 0,
    calorieTarget: 2018,
    chest: null,
  });
  assert.equal(day.title, "Записано 0% цели");
  assert.deepEqual(day.cta, { label: "Записать еду", action: "food" });
});

test("вечер: зачтено 1 из 3 — кнопка не открывает сундук", () => {
  const day = resolveEveningDay({
    logged: true,
    waterMl: 2000,
    waterTarget: 2000,
    calories: 400,
    calorieTarget: 2018,
    chest: calmChest({ state: "filling", questDayCount: 1, todayMarked: true }),
  });
  assert.equal(day.title, "День засчитан");
  assert.deepEqual(day.cta, { label: "Ещё 2 спокойных дня до сундука", disabled: true });
});

test("вечер: зачтено 2 из 3", () => {
  const day = resolveEveningDay({
    logged: true,
    waterMl: 2000,
    waterTarget: 2000,
    calories: 1800,
    calorieTarget: 2018,
    chest: calmChest({ state: "filling", questDayCount: 2, todayMarked: true }),
  });
  assert.equal(day.title, "День засчитан");
  assert.deepEqual(day.cta, { label: "Ещё 1 спокойный день до сундука", disabled: true });
});

test("вечер: сундук готов — открыть только когда meter ready", () => {
  const waiting = resolveEveningDay({
    logged: true,
    waterMl: 2000,
    waterTarget: 2000,
    calories: 1800,
    calorieTarget: 2018,
    chest: calmChest({ state: "filling", questDayCount: 2, todayMarked: false }),
  });
  assert.equal(waiting.title, "Сундук готов");
  assert.deepEqual(waiting.cta, { label: "Открыть сундук", disabled: true });

  const ready = resolveEveningDay({
    logged: true,
    waterMl: 2000,
    waterTarget: 2000,
    calories: 1800,
    calorieTarget: 2018,
    chest: calmChest({
      state: "ready",
      questDayCount: 3,
      todayMarked: true,
      head: { source: "quest", detail: "Открой — награда в коллекцию" },
    }),
  });
  assert.equal(ready.title, "Сундук готов");
  assert.deepEqual(ready.cta, { label: "Открыть сундук", action: "chest" });
});

test("вечер: очередь пуста и день уже в закрытом круге", () => {
  const day = resolveEveningDay({
    logged: true,
    waterMl: 2000,
    waterTarget: 2000,
    calories: 1800,
    calorieTarget: 2018,
    chest: calmChest({ state: "filling", questDayCount: 3, openedQuestChests: 1, todayMarked: true }),
  });
  assert.equal(day.title, "День засчитан");
  assert.deepEqual(day.cta, { label: "Сундук уже открыт", href: "/profile#rewards" });
});

test("вечер: сундук серии, недели и челленджа подписывает источник", () => {
  const streak = resolveEveningDay({
    logged: true,
    waterMl: 500,
    waterTarget: 2000,
    calories: 400,
    calorieTarget: 2018,
    chest: calmChest({
      state: "ready",
      questDayCount: 1,
      todayMarked: true,
      head: { source: "streak", detail: "100 дней подряд", milestone: 100, label: "Серия · 100" },
    }),
  });
  assert.equal(streak.title, "Сундук за серию 100");
  assert.equal(streak.sourceHint, "Серия дней");
  assert.deepEqual(streak.cta, { label: "Открыть сундук", action: "chest" });

  const week = resolveEveningDay({
    logged: true,
    waterMl: 2000,
    waterTarget: 2000,
    calories: 1800,
    calorieTarget: 2018,
    chest: calmChest({
      state: "ready",
      head: { source: "week", detail: "Неделя закрыта", label: "Спокойная неделя" },
    }),
  });
  assert.equal(week.title, "Сундук за спокойную неделю");
  assert.equal(week.sourceHint, "Спокойная неделя");

  const challenge = resolveEveningDay({
    logged: true,
    waterMl: 2000,
    waterTarget: 2000,
    calories: 1800,
    calorieTarget: 2018,
    chest: calmChest({
      state: "ready",
      head: { source: "challenge", detail: "открой", label: "Челлендж · Пять дней дневника" },
    }),
  });
  assert.equal(challenge.title, "Сундук за челлендж");
  assert.equal(challenge.sourceHint, "Челлендж · Пять дней дневника");
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
