import assert from "node:assert/strict";
import { test } from "node:test";
import {
  actionsHaveWritablePayload,
  assistantWroteFlag,
  assistantWriteMissNote,
  extractActionsJson,
  heuristicRepairFromDraftReply,
  heuristicRepairMultiDishActions,
  heuristicRepairPortionPatchActions,
  heuristicRepairPatchWorkoutActions,
  heuristicRepairRepeatWorkoutActions,
  heuristicRepairStartWorkoutActions,
  heuristicRepairSlotEditActions,
  heuristicRepairWriteActions,
  messageLooksLikeMultiDish,
  needsWriteRepair,
  parsePortionGramsFromMessage,
  parseStructuredMealsFromText,
  preferMultiDishActions,
  preferSlotEditActions,
  pruneNoopAssistantActions,
  sanitizeAssistantMealName,
} from "./assistant-repair.ts";
import { normalizeAssistantActions } from "./admin-assistant.ts";
import { sanitizePendingWriteReply } from "./assistant-honesty.ts";
import {
  userWantsGymEdit,
  userWantsRepeatWorkout,
  userWantsStartEmptyWorkout,
  userWantsStartWorkout,
  userWantsWrite,
} from "./assistant-intent.ts";
import { lookupRuNutritionTable } from "./ru-nutrition-lookup.ts";

test("needsWriteRepair when user asked to add but no meals", () => {
  assert.equal(
    needsWriteRepair("добавь булочку в рацион", null),
    true,
  );
  assert.equal(
    needsWriteRepair("добавь булочку", { meals: [{ name: "Булочка", kcal: 300 }] }),
    false,
  );
  assert.equal(needsWriteRepair("что поесть?", null), false);
  assert.equal(needsWriteRepair("Протеин изолят 60г на перекус", null), true);
});

test("heuristicRepairWriteActions for protein isolate snack", () => {
  const actions = heuristicRepairWriteActions("Протеин изолят 60г на перекус");
  assert.ok(actions?.meals?.length);
  assert.match(actions!.meals![0]!.name, /протеин/i);
  assert.equal(actions!.meals![0]!.note, "перекус");
  assert.ok((actions!.meals![0]!.kcal ?? 0) > 100);
});

test("heuristicRepairFromDraftReply builds ActionCard from bullet draft", () => {
  const reply =
    "Ок, кидаю в план:\n\n- Перекус: протеин изолят 60 г (~220 ккал, Б50 Ж0 У0)\n\nНажми кнопку подтверждения, чтобы сохранить.";
  const actions = heuristicRepairFromDraftReply("Протеин изолят 60г на перекус", reply);
  assert.ok(actions?.meals?.length);
  assert.equal(actions!.meals![0]!.kcal, 220);
  assert.equal(actions!.meals![0]!.protein, 50);
  assert.equal(actions!.meals![0]!.note, "перекус");
  assert.match(actions!.meals![0]!.name, /протеин/i);
  assert.doesNotMatch(actions!.meals![0]!.name, /^перекус/i);
});

test("confirm-gate: pending ActionCard is not a write miss", () => {
  const meals = { meals: [{ name: "Печень с рисом", kcal: 400 }] };
  assert.equal(
    assistantWroteFlag({
      wroteOk: false,
      actions: meals,
      userMessage: "Я съел печень с рисом 500гр",
    }),
    null,
  );
  assert.equal(
    assistantWriteMissNote({
      wroteOk: false,
      actions: meals,
      userMessage: "Я съел печень с рисом 500гр",
    }),
    "",
  );
  assert.equal(
    assistantWroteFlag({
      wroteOk: false,
      actions: null,
      userMessage: "Я съел печень с рисом 500гр",
    }),
    false,
  );
  assert.match(
    assistantWriteMissNote({
      wroteOk: false,
      actions: null,
      userMessage: "Я съел печень с рисом 500гр",
    }),
    /Не удалось/,
  );
});

test("extractActionsJson from fence and raw object", () => {
  const fenced = extractActionsJson(
    'Ок\n```cv-actions\n{"apply":true,"meals":[{"name":"Суп","kcal":200}]}\n```',
  );
  assert.equal(fenced?.meals?.[0]?.name, "Суп");

  const raw = extractActionsJson(
    'Готово {"apply":true,"meals":[{"name":"Каша","kcal":250}]}',
  );
  assert.equal(raw?.meals?.[0]?.name, "Каша");
  assert.equal(actionsHaveWritablePayload(raw), true);
});

test("extractActionsJson ignores empty apply false", () => {
  assert.equal(extractActionsJson('{"apply":false}'), null);
});

test("parsePortionGramsFromMessage liters and grams", () => {
  assert.equal(parsePortionGramsFromMessage("Я выпил 3 литра светлого пива"), 3000);
  assert.equal(parsePortionGramsFromMessage("500 мл колы"), 500);
  assert.equal(parsePortionGramsFromMessage("нога индейки 300гр"), 300);
});

test("heuristicRepairWriteActions builds beer meal for liters", () => {
  const actions = heuristicRepairWriteActions("Я выпил 3 литра светлого лёгкого пива");
  assert.ok(actions?.meals?.length);
  assert.match(actions!.meals![0]!.name, /Пиво/i);
  assert.ok((actions!.meals![0]!.kcal ?? 0) >= 900);
  assert.equal(actions!.apply, true);
  assert.equal(actions!.targetDate, "сегодня");
  assert.equal(
    needsWriteRepair("Я выпил 3 литра светлого лёгкого пива", actions),
    false,
  );
});

const YESTERDAY_DINNER = `Вчерашний ужин:

- Картошка пюре (~200 ккал, Б4 Ж3 У35)
- Котлета рыбная (~150 ккал, Б20 Ж5 У5)
- Пиво светлое 3 л (~900 ккал, Б0 Ж0 У90)

Всего около 1250 ккал.`;

test("yesterday dinner is write intent and multi-dish", () => {
  assert.equal(userWantsWrite(YESTERDAY_DINNER), true);
  assert.equal(messageLooksLikeMultiDish(YESTERDAY_DINNER), true);
  assert.equal(heuristicRepairWriteActions(YESTERDAY_DINNER), null);
});

test("parseStructuredMealsFromText reads bullet macros", () => {
  const meals = parseStructuredMealsFromText(YESTERDAY_DINNER);
  assert.equal(meals.length, 3);
  assert.match(meals[0]!.name, /пюре|Картоф/i);
  assert.equal(meals[0]!.kcal, 200);
  assert.equal(meals[1]!.kcal, 150);
  assert.ok((meals[2]!.kcal ?? 0) >= 900);
});

test("heuristicRepairMultiDishActions logs yesterday dinner as 3 meals", () => {
  const actions = heuristicRepairMultiDishActions(YESTERDAY_DINNER);
  assert.ok(actions?.meals);
  assert.equal(actions!.meals!.length, 3);
  assert.equal(actions!.targetDate, "вчера");
  assert.ok(actions!.meals!.every((m) => m.note === "ужин"));
  assert.match(actions!.summary ?? "", /пюре|Пиво|Котлет/i);
});

test("preferMultiDishActions replaces beer-only model collapse", () => {
  const collapsed = {
    apply: true as const,
    targetDate: "сегодня",
    meals: [{ name: "Пиво светлое (3000 мл)", kcal: 1273, note: "перекус" }],
  };
  const fixed = preferMultiDishActions(YESTERDAY_DINNER, "", collapsed);
  assert.equal(fixed?.meals?.length, 3);
  assert.equal(fixed?.targetDate, "вчера");
  assert.ok(fixed?.meals?.every((m) => m.note === "ужин"));
});

test("heuristicRepairSlotEditActions patches whole breakfast time", () => {
  const actions = heuristicRepairSlotEditActions(
    "Исправь сегодняшний завтрак - время 6:30",
  );
  assert.equal(actions?.patchMeals?.length, 1);
  assert.equal(actions?.patchMeals?.[0]?.mealType, "BREAKFAST");
  assert.equal(actions?.patchMeals?.[0]?.time, "06:30");
  assert.equal(actions?.targetDate, "сегодня");
});

test("heuristicRepairSlotEditActions deletes whole dinner", () => {
  const actions = heuristicRepairSlotEditActions("удали ужин");
  assert.equal(actions?.deleteMeals?.[0]?.mealType, "DINNER");
  assert.equal(actions?.deleteMeals?.[0]?.match, "ужин");
});

test("preferSlotEditActions wins over dish-list patches for slot time", () => {
  const model = {
    apply: true as const,
    patchMeals: [
      { match: "Печенье" },
      { match: "Оладьи" },
    ],
  };
  const fixed = preferSlotEditActions(
    "Исправь сегодняшний завтрак - время 6:30",
    model,
  );
  assert.equal(fixed?.patchMeals?.length, 1);
  assert.equal(fixed?.patchMeals?.[0]?.mealType, "BREAKFAST");
  assert.equal(fixed?.patchMeals?.[0]?.time, "06:30");
});

test("pruneNoopAssistantActions drops match-only patches", () => {
  assert.equal(
    actionsHaveWritablePayload({
      patchMeals: [{ match: "Печенье" }],
    }),
    false,
  );
  assert.equal(
    pruneNoopAssistantActions({
      apply: true,
      patchMeals: [{ match: "Печенье" }, { match: "Оладьи", time: "06:30" }],
    })?.patchMeals?.length,
    1,
  );
});

test("heuristicRepairSlotEditActions moves lunch to dinner", () => {
  const actions = heuristicRepairSlotEditActions("перенеси обед в ужин");
  assert.equal(actions?.patchMeals?.[0]?.mealType, "LUNCH");
  assert.equal(actions?.patchMeals?.[0]?.toMealType, "DINNER");
  assert.equal(actions?.patchMeals?.[0]?.match, "обед");
});

test("heuristicRepairSlotEditActions portions whole breakfast", () => {
  const actions = heuristicRepairSlotEditActions("исправь завтрак на 200 г");
  assert.equal(actions?.patchMeals?.[0]?.mealType, "BREAKFAST");
  assert.equal(actions?.patchMeals?.[0]?.portionGrams, 200);
});

test("write depth: genitive slot time patch", () => {
  const actions = heuristicRepairSlotEditActions("измени время завтрака на 6:30");
  assert.equal(actions?.patchMeals?.[0]?.mealType, "BREAKFAST");
  assert.equal(actions?.patchMeals?.[0]?.time, "06:30");
});

test("write depth: slot move synonyms", () => {
  assert.equal(
    heuristicRepairSlotEditActions("перемести обед в ужин")?.patchMeals?.[0]?.toMealType,
    "DINNER",
  );
  assert.equal(
    heuristicRepairSlotEditActions("сделай обед ужином")?.patchMeals?.[0]?.toMealType,
    "DINNER",
  );
});

test("write depth: inline yesterday dinner without bullets", () => {
  const msg = "Вчерашний ужин: пюре, котлета, пиво 3л";
  assert.equal(messageLooksLikeMultiDish(msg), true);
  const actions = heuristicRepairMultiDishActions(msg);
  assert.ok((actions?.meals?.length ?? 0) >= 2);
  assert.equal(actions?.targetDate, "вчера");
  assert.ok(actions?.meals?.every((m) => m.note === "ужин"));
});

test("write depth: snack в перекус / снек", () => {
  assert.equal(userWantsWrite("снек протеин 40г"), true);
  assert.equal(userWantsWrite("добавь банан в перекус"), true);
  const banana = heuristicRepairWriteActions("добавь банан в перекус");
  assert.ok(banana?.meals?.length);
  assert.equal(banana!.meals![0]!.note, "перекус");
  assert.match(banana!.meals![0]!.name, /банан/i);
});

test("heuristicRepairPortionPatchActions patches dish grams", () => {
  assert.equal(userWantsWrite("сделай омлет 200 г"), true);
  const actions = heuristicRepairPortionPatchActions("сделай омлет 200 г");
  assert.equal(actions?.patchMeals?.[0]?.match, "омлет");
  assert.equal(actions?.patchMeals?.[0]?.portionGrams, 200);
});

test("preferSlotEditActions wins for slot move", () => {
  const fixed = preferSlotEditActions("перенеси обед на ужин", {
    apply: true,
    meals: [{ name: "Суп", kcal: 200 }],
  });
  assert.equal(fixed?.patchMeals?.[0]?.toMealType, "DINNER");
  assert.equal(fixed?.meals, undefined);
});

test("userWantsGymEdit and heuristicRepairPatchWorkoutActions", () => {
  assert.equal(userWantsGymEdit("Добавь жим лёжа"), true);
  assert.equal(userWantsGymEdit("поставь 80×8 на жим"), true);
  assert.equal(userWantsGymEdit("Что поесть?"), false);

  const add = heuristicRepairPatchWorkoutActions("Добавь жим лёжа 80x8");
  assert.ok(add?.patchWorkout?.addExercises?.length);
  assert.match(add!.patchWorkout!.addExercises![0]!.name, /жим/i);

  const log = heuristicRepairPatchWorkoutActions("поставь 80×8 на жим");
  assert.ok(log?.patchWorkout?.logSets?.length);
  assert.equal(log!.patchWorkout!.logSets![0]!.weightKg, 80);
  assert.equal(log!.patchWorkout!.logSets![0]!.reps, 8);
});

test("gym write: подход → logSets; empty start; копируй", () => {
  assert.equal(userWantsGymEdit("Добавь подход на жим 80×8"), true);
  const setLog = heuristicRepairPatchWorkoutActions("Добавь подход на жим 80×8");
  assert.ok(setLog?.patchWorkout?.logSets?.length);
  assert.match(setLog!.patchWorkout!.logSets![0]!.match ?? "", /жим/i);
  assert.equal(setLog!.patchWorkout!.logSets![0]!.weightKg, 80);

  assert.equal(userWantsGymEdit("Поставь 80 на 8 на жим"), true);
  const na = heuristicRepairPatchWorkoutActions("Поставь 80 на 8 на жим");
  assert.equal(na?.patchWorkout?.logSets?.[0]?.weightKg, 80);
  assert.equal(na?.patchWorkout?.logSets?.[0]?.reps, 8);

  assert.equal(userWantsStartEmptyWorkout("Начни пустую тренировку"), true);
  assert.equal(userWantsStartWorkout("Начни тренировку"), true);
  assert.equal(
    heuristicRepairStartWorkoutActions("Начни пустую тренировку")?.startEmptyWorkout,
    true,
  );
  assert.equal(
    heuristicRepairStartWorkoutActions("Начни тренировку")?.startWorkout,
    true,
  );

  assert.equal(userWantsRepeatWorkout("Скопируй прошлую тренировку"), true);
  assert.equal(
    heuristicRepairRepeatWorkoutActions("Скопируй прошлую тренировку")?.repeatWorkout,
    true,
  );
});

test("userWantsRepeatWorkout and heuristicRepairRepeatWorkoutActions", () => {
  assert.equal(userWantsRepeatWorkout("Повтори последнюю тренировку"), true);
  assert.equal(userWantsRepeatWorkout("повтори вчерашний зал"), true);
  assert.equal(userWantsRepeatWorkout("Что поесть?"), false);
  assert.equal(userWantsWrite("Повтори последнюю тренировку"), true);

  const last = heuristicRepairRepeatWorkoutActions("Повтори последнюю тренировку");
  assert.equal(last?.repeatWorkout, true);
  assert.equal(last?.targetDate, "сегодня");
  assert.equal(last?.apply, true);

  // «вчерашний зал» alone → clone onto сегодня (not onto вчера)
  const yday = heuristicRepairRepeatWorkoutActions("Повтори вчерашний зал");
  assert.equal(yday?.repeatWorkout, true);
  assert.equal(yday?.targetDate, "сегодня");

  const onYday = heuristicRepairRepeatWorkoutActions(
    "Повтори последнюю тренировку на вчера",
  );
  assert.equal(onYday?.targetDate, "вчера");

  assert.equal(
    needsWriteRepair("Повтори вчерашний зал", null),
    true,
  );
  assert.equal(
    needsWriteRepair("Повтори вчерашний зал", {
      apply: true,
      repeatWorkout: true,
      targetDate: "сегодня",
    }),
    false,
  );
  assert.equal(
    actionsHaveWritablePayload({ repeatWorkout: true }),
    true,
  );
});

/** Screenshot bug: full-word macros + hallucinated «✓ В рацион» line. */
const SCREENSHOT_REPLY = `Ок, добавляю:

- Блины с мясом (3 шт.): ~450 ккал, белки 24 г, жиры 15 г, углеводы 50 г
- Дамплинги с креветками (7 шт.): ~420 ккал, белки 30 г, жиры 15 г, углеводы 40 г
- Сельдерей с хумусом: ~150 ккал, белки 5 г, жиры 10 г, углеводы 10 г

✓ В рацион 2026-10-18: Блины с мясом (450 ккал), Дамплинги (420 ккал), Сельдерей с хумусом (150 ккал)

Нажми кнопку подтверждения.`;

test("screenshot multi-dish: 3 meals, clean names, carbs not portion", () => {
  const meals = parseStructuredMealsFromText(SCREENSHOT_REPLY);
  assert.equal(meals.length, 3);
  assert.match(meals[0]!.name, /Блины/i);
  assert.doesNotMatch(meals[0]!.name, /углеводы|В рацион/i);
  assert.doesNotMatch(meals[0]!.name, /\(10 г\)/);
  assert.equal(meals[0]!.kcal, 450);
  assert.equal(meals[0]!.carbs, 50);
  assert.equal(meals[0]!.protein, 24);
  assert.match(meals[1]!.name, /Дамплинг/i);
  assert.equal(meals[1]!.kcal, 420);
  assert.equal(meals[1]!.carbs, 40);
  assert.match(meals[2]!.name, /Сельдерей|хумус/i);
  assert.equal(meals[2]!.kcal, 150);
  assert.equal(meals[2]!.carbs, 10);

  const actions = heuristicRepairFromDraftReply(
    "добавь блины дамплинги сельдерей",
    SCREENSHOT_REPLY,
  );
  assert.equal(actions?.meals?.length, 3);
  assert.match(actions!.summary ?? "", /Блины/i);
  assert.doesNotMatch(actions!.summary ?? "", /углеводы|В рацион/i);
});

test("sanitizeAssistantMealName strips tool/macro leak", () => {
  assert.match(
    sanitizeAssistantMealName(
      "углеводы ✓ В рацион 2026-10-18: Блины с мясом (10 г)",
    ),
    /^Блины/,
  );
});

test("normalizeAssistantActions cleans polluted meal names", () => {
  const ok = normalizeAssistantActions({
    meals: [
      {
        name: "углеводы ✓ В рацион 2026-10-18: Блины с мясом",
        kcal: 450,
        carbs: 50,
      },
    ],
  });
  assert.match(ok?.meals?.[0]?.name ?? "", /^Блины/);
  assert.equal(ok?.meals?.[0]?.carbs, 50);
});

test("preferMultiDishActions replaces polluted 2-meal card with 3", () => {
  const polluted = {
    apply: true as const,
    meals: [
      {
        name: "углеводы ✓ В рацион 2026-10-18: Блины с мясом (10 г)",
        kcal: 450,
      },
      { name: "Дамплинги", kcal: 420 },
    ],
  };
  const fixed = preferMultiDishActions(
    "добавь блины дамплинги сельдерей",
    SCREENSHOT_REPLY,
    polluted,
  );
  assert.equal(fixed?.meals?.length, 3);
  assert.doesNotMatch(fixed!.meals![0]!.name, /углеводы|В рацион/i);
});

test("sanitizePendingWriteReply drops false ✓ В рацион line", () => {
  const out = sanitizePendingWriteReply(SCREENSHOT_REPLY);
  assert.doesNotMatch(out, /✓\s*В рацион/);
  assert.match(out, /подтверд|не записал/i);
});

/** Screenshot: four dairy/PB items — peanut butter must stay on ActionCard. */
const USER =
  "Я съел творог обезжиренный 200г, арахисовая паста 15г, молоко 100г, обезжиренный греческий йогурт 100г";

const REPLY = `Хорошо, вот ваши продукты:

- Творог обезжиренный (200 г): ~147 ккал, белки 44 г, жиры 0.7 г, углеводы 6.7 г
- Арахисовая паста (15 г): ~90 ккал, белки 4 г, жиры 7 г, углеводы 3 г
- Молоко 2,5% (100 г): ~48 ккал, белки 1.2 г, жиры 1 г, углеводы 2 г
- Греческий йогурт обезжиренный (100 г): ~100 ккал, белки 8 г, жиры 4 г, углеводы 6.7 г

Нажми кнопку подтверждения.`;

test("lookup peanut butter not pasta", () => {
  const hit = lookupRuNutritionTable("арахисовая паста");
  assert.ok(hit);
  assert.match(hit!.dishName, /арахис/i);
  assert.doesNotMatch(hit!.dishName, /макарон/i);
});

test("screenshot: ActionCard keeps all 4 including peanut butter", () => {
  const meals = parseStructuredMealsFromText(REPLY);
  assert.equal(meals.length, 4);
  assert.ok(meals.some((m) => /арахис/i.test(m.name)));
  assert.ok(meals.every((m) => !/\(\s*\)/.test(m.name)));

  const multi = heuristicRepairMultiDishActions(USER, REPLY);
  assert.equal(multi?.meals?.length, 4);
  assert.ok(multi!.meals!.some((m) => /арахис/i.test(m.name)));

  const draft = heuristicRepairFromDraftReply(USER, REPLY);
  assert.equal(draft?.meals?.length, 4);

  const fixed = preferMultiDishActions(USER, REPLY, {
    apply: true,
    meals: [
      { name: "Творог обезжиренный (200 г)", kcal: 147 },
      { name: "Молоко 2,5% (100 г)", kcal: 48 },
      { name: "Греческий йогурт (100 г)", kcal: 100 },
    ],
  });
  assert.equal(fixed?.meals?.length, 4);
  assert.ok(fixed!.meals!.some((m) => /арахис/i.test(m.name)));
});

test("user message alone finds peanut butter via table", () => {
  const multi = heuristicRepairMultiDishActions(USER);
  assert.ok((multi?.meals?.length ?? 0) >= 4);
  assert.ok(multi!.meals!.some((m) => /арахис/i.test(m.name)));
});
