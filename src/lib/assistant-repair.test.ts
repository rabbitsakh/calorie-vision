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
  messageHasExplicitMealEdit,
  messageLogsNewEatenFood,
  messageLooksLikeMultiDish,
  needsWriteRepair,
  extractKcalFromReply,
  heuristicRepairFromProseKcal,
  replyEstimatesBareDish,
  parsePortionGramsFromMessage,
  parseStructuredMealsFromText,
  preferMultiDishActions,
  preferSlotEditActions,
  pruneNoopAssistantActions,
  sanitizeAssistantMealName,
  replyPromisesWriteCard,
  repairAssistantWriteActions,
  dishNameFromUserLog,
  isNutrientLabelName,
  salvageNutrientLabelMeals,
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
import { enrichQuickMealsFromText, quickMacroLine, splitQuickPortion } from "./quick-log.ts";

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
  assert.ok(fixed!.meals!.every((m) => !/^я\s+съел/i.test(m.name)));
  assert.match(fixed!.meals!.find((m) => /арахис/i.test(m.name))!.name, /^Арахисовая/i);
});

test("user message alone finds peanut butter via table", () => {
  const multi = heuristicRepairMultiDishActions(USER);
  assert.ok((multi?.meals?.length ?? 0) >= 4);
  assert.ok(multi!.meals!.some((m) => /арахис/i.test(m.name)));
});

/** Screenshot: eggs dropped + syrok 880 kcal from glazed 50г×4. */
const EGGS_SYROK_USER = "Я съел 4 варёных яйца и творожный сырок 200г";
const EGGS_SYROK_REPLY = `Замечательно, фиксирую завтрак:
4 варёных яйца: около 280 ккал, белки 24 г, жиры 20 г, углеводы 2 г
Творожный сырок (200 г): около 300 ккал, белки 16 г, жиры 20 г, углеводы 15 г
Итого: около 580 ккал, белки 40 г, жиры 40 г, углеводы 17 г.
Нажми подтвердить, чтобы внести в дневник.`;

test("eggs+syrok: plain draft lines (no bullets) parse both dishes", () => {
  const meals = parseStructuredMealsFromText(EGGS_SYROK_REPLY);
  assert.equal(meals.length, 2);
  assert.ok(meals.some((m) => /яйц/i.test(m.name)));
  assert.ok(meals.some((m) => /сырок/i.test(m.name)));
  assert.equal(meals.find((m) => /яйц/i.test(m.name))!.kcal, 280);
  assert.equal(meals.find((m) => /сырок/i.test(m.name))!.kcal, 300);
  assert.ok(meals.every((m) => !/около/i.test(m.name)));
});

test("eggs+syrok: preferMultiDish replaces syrok-only 880 card", () => {
  const fixed = preferMultiDishActions(EGGS_SYROK_USER, EGGS_SYROK_REPLY, {
    apply: true,
    meals: [
      {
        name: "Творожный сырок (200 г)",
        kcal: 880,
        protein: 32,
        fat: 48,
        carbs: 80,
        note: "перекус",
      },
    ],
  });
  assert.equal(fixed?.meals?.length, 2);
  assert.ok(fixed!.meals!.some((m) => /яйц/i.test(m.name)));
  const syrok = fixed!.meals!.find((m) => /сырок/i.test(m.name))!;
  assert.equal(syrok.kcal, 300);
  assert.ok((syrok.kcal ?? 0) < 500);
  assert.ok(fixed!.meals!.every((m) => m.note === "завтрак"));
});

test("eggs+syrok: user inline keeps both with piece count", () => {
  assert.equal(messageLooksLikeMultiDish(EGGS_SYROK_USER), true);
  const multi = heuristicRepairMultiDishActions(EGGS_SYROK_USER);
  assert.equal(multi?.meals?.length, 2);
  const eggs = multi!.meals!.find((m) => /яйц/i.test(m.name))!;
  assert.ok((eggs.kcal ?? 0) >= 250);
  assert.ok((eggs.kcal ?? 0) <= 350);
});

const CEREAL_USER =
  "На завтрак в 7 утра я съел 200г обезжиренного творога, 100 мл молока, 50гр подушечек сухой завтрак, 10 гр арахисовой пасты";
const CEREAL_REPLY = [
  "Ок, записываю завтрак в 7 утра.",
  "",
  "Состав такой:",
  "- Обезжиренный творог (200 г)",
  "- Молоко (100 мл)",
  "- Сухие подушечки-завтрак (50 г)",
  "- Арахисовая паста (10 г)",
  "",
  "Нажмите подтвердить, чтобы сохранить изменения.",
].join("\n");

test("cereal pillows: draft keeps all 4 dishes incl. подушечки", () => {
  const fixed = preferMultiDishActions(CEREAL_USER, CEREAL_REPLY, {
    apply: true,
    meals: [
      { name: "Обезжиренный творог (200 г)", kcal: 147, note: "завтрак" },
      { name: "Молоко (100 мл)", kcal: 48, note: "завтрак" },
      { name: "Арахисовая паста (10 г)", kcal: 59, note: "завтрак" },
    ],
  });
  assert.equal(fixed?.meals?.length, 4);
  const pillows = fixed!.meals!.find((m) => /подушеч/i.test(m.name))!;
  assert.ok(pillows, "подушечки must not be dropped");
  assert.equal(pillows.kcal, 215);
  assert.ok(fixed!.meals!.every((m) => m.note === "завтрак"));
});

test("cereal pillows: user inline alone never yields a partial card", () => {
  const multi = heuristicRepairMultiDishActions(CEREAL_USER);
  if (multi) {
    assert.equal(multi.meals?.length, 4);
  }
  const meals = parseStructuredMealsFromText("на завтрак 50гр подушечек, 100 г творога");
  assert.ok(meals.every((m) => !/^р\s/i.test(m.name)), "«50гр» must not leave a stray «р»");
});

test("unpriced dish stays on the card as «не разобрано», priced rows remain", () => {
  const user = "На завтрак съел 200г творога, 50 г чучхелы и 100 мл молока";
  const reply = "Записываю:\n- Творог (200 г)\n- Чучхела (50 г)\n- Молоко (100 мл)";
  const multi = heuristicRepairMultiDishActions(user, reply);
  assert.equal(multi?.meals?.length, 3);
  const unknown = multi!.meals!.find((m) => /чучхел/i.test(m.name));
  assert.equal(unknown?.unparsed, true);
  assert.equal(unknown?.kcal, undefined);
  assert.equal(splitQuickPortion(unknown!.name).grams, 50);
  assert.ok(multi!.meals!.some((m) => /творог/i.test(m.name) && (m.kcal ?? 0) > 0));
  assert.ok(multi!.meals!.some((m) => /молок/i.test(m.name) && (m.kcal ?? 0) > 0));
  const draft = heuristicRepairFromDraftReply(user, reply);
  assert.equal(draft?.meals?.filter((m) => m.unparsed).length, 1);
});

test("lookup: dry breakfast cereals by grams", () => {
  assert.equal(lookupRuNutritionTable("Сухие подушечки-завтрак")?.dishName, "Сухой завтрак подушечки");
  assert.equal(lookupRuNutritionTable("подушечек сухой завтрак")?.dishName, "Сухой завтрак подушечки");
  assert.equal(lookupRuNutritionTable("кукурузные хлопья")?.dishName, "Кукурузные хлопья");
  assert.equal(lookupRuNutritionTable("мюсли")?.dishName, "Мюсли");
});

test("repair prompt asks for ~1300 kcal of light beer, not 900–1300", async () => {
  let system = "";
  await repairAssistantWriteActions({
    userMessage: "запиши кварцевый мусс zzq",
    assistantReply: "Хорошо.",
    today: "2026-11-04",
    date: "2026-11-04",
    allowRepairLlm: true,
    completeRepairChat: async (messages) => {
      system = messages[0]?.content ?? "";
      return '{"apply":false}';
    },
  });
  assert.match(system, /~1300 ккал/);
  assert.doesNotMatch(system, /900–1300|900-1300/);
});

test("bare dish + reply that promises a card → repair builds the meal from the draft", async () => {
  const reply =
    "Лакомство принято:\n\n- Мороженое (стандартная порция около 100 г): примерно 200 ккал, белки 4 г, жиры 10 г, углеводы 20 г\n\n✅ Сохраняйте в дневник, подтверждая ниже.";
  assert.equal(replyPromisesWriteCard(reply), true);
  assert.equal(needsWriteRepair("Мороженое", null), false);
  assert.equal(needsWriteRepair("Мороженое", null, reply), true);
  const actions = await repairAssistantWriteActions({
    userMessage: "Мороженое",
    assistantReply: reply,
    today: "2026-10-28",
    date: "2026-10-28",
  });
  assert.equal(actions?.meals?.length, 1);
  assert.match(actions!.meals![0]!.name, /Мороженое/);
  assert.equal(actions!.meals![0]!.kcal, 200);
  assert.ok(
    assistantWriteMissNote({ wroteOk: false, actions: null, userMessage: "Мороженое", assistantReply: reply }),
  );
});

test("replyPromisesWriteCard ignores plain advice", () => {
  assert.equal(replyPromisesWriteCard("Мороженое — около 200 ккал на 100 г."), false);
  assert.equal(replyPromisesWriteCard("Можно добавить в дневник позже."), false);
  assert.equal(replyPromisesWriteCard("Нажми «В дневник» под карточкой."), true);
});

const CHEB_USER = "Чебурек с фаршем индейки";
const CHEB_REPLY =
  "Чебурек с фаршем индейки — примерно 250 ккал (Б 12 г, Ж 14 г, У 20 г). ✅ Подтверждайте запись в дневник.";

test("prose «Подтверждайте запись» / «Запиши … в дневник?» owes a confirm card", () => {
  assert.equal(replyPromisesWriteCard(CHEB_REPLY), true);
  assert.equal(replyPromisesWriteCard("Запиши чебурек в дневник? Около 250 ккал."), true);
  assert.equal(needsWriteRepair(CHEB_USER, null, CHEB_REPLY), true);
  assert.equal(needsWriteRepair(CHEB_USER, null, "Запиши чебурек в дневник? ~250 ккал"), true);
});

test("bare dish + kcal estimate needs repair; questions stay read-only", () => {
  assert.equal(replyEstimatesBareDish(CHEB_USER, "Чебурек — около 250 ккал."), true);
  assert.equal(needsWriteRepair(CHEB_USER, null, "Чебурек — около 250 ккал."), true);
  assert.equal(needsWriteRepair("Сколько калорий в чебуреке?", null, "Около 250 ккал."), false);
});

test("extractKcalFromReply отличает «на 100 г» от ккал порции", () => {
  assert.equal(
    extractKcalFromReply("На 100 г 240 ккал, окорочок ~300 г ≈ 740 ккал."),
    740,
  );
  assert.equal(extractKcalFromReply("Окорочок гриль (100 г) — 740 ккал. Кожу лучше снять."), 740);
  assert.equal(extractKcalFromReply("примерно 250 ккал"), 250);
  assert.equal(extractKcalFromReply("Мороженое — около 200 ккал на 100 г."), 200);
});

test("проза «(100 г) — 740 ккал» у окорочка становится типовой штукой", () => {
  const actions = heuristicRepairFromProseKcal(
    "Окорочок гриль куриный",
    "Окорочок гриль куриный (100 г) — 740 ккал. С кожей жирнее.",
  );
  const meal = actions?.meals?.[0];
  assert.ok(meal);
  assert.equal(splitQuickPortion(meal.name).grams, 200);
  assert.equal(meal.kcal, 470);
  assert.equal(meal.protein, 44);
  assert.equal(meal.fat, 30);
  assert.equal(meal.carbs, 0);
});

test("проза с плотностью и весом куска берёт ккал куска, не «на 100 г»", () => {
  const actions = heuristicRepairFromProseKcal(
    "Окорочок гриль куриный",
    "На 100 г 240 ккал, окорочок ~300 г ≈ 740 ккал.",
  );
  const meal = actions?.meals?.[0];
  assert.ok(meal);
  assert.equal(splitQuickPortion(meal.name).grams, 300);
  assert.equal(meal.kcal, 740);
});

test("offline prose fallback extracts kcal + БЖУ into a meal", () => {
  const a = heuristicRepairFromProseKcal(CHEB_USER, CHEB_REPLY);
  assert.equal(a?.apply, true);
  const m = a?.meals?.[0];
  assert.equal(m?.kcal, 250);
  assert.equal(m?.protein, 12);
  assert.equal(m?.fat, 14);
  assert.equal(m?.carbs, 20);
  assert.match(m?.name ?? "", /чебурек/i);
});

test("«Чебурек (100 г)» fills the confirm card grams field", () => {
  const user = "Чебурек (100 г)";
  const reply =
    "Чебурек (100 г) — примерно 250 ккал (Б 12 г, Ж 14 г, У 20 г). Подтверждайте запись в дневник.";
  const a = heuristicRepairFromProseKcal(user, reply);
  const meal = a?.meals?.[0];
  assert.ok(meal);
  assert.equal(meal.name, "Чебурек (100 г)");
  const shown = splitQuickPortion(enrichQuickMealsFromText([meal], a?.summary ?? "")[0]!.name);
  assert.equal(shown.base, "Чебурек");
  assert.equal(shown.grams, 100);
  assert.equal(shown.unit, "г");
});

test("grams in the reply dish name fill the card when the user omitted them", () => {
  const a = heuristicRepairFromProseKcal(
    "Чебурек",
    "Чебурек (180 г) — примерно 400 ккал. Подтверждайте запись в дневник.",
  );
  const meal = a?.meals?.[0];
  assert.ok(meal);
  const shown = splitQuickPortion(enrichQuickMealsFromText([meal], a?.summary ?? "")[0]!.name);
  assert.equal(shown.base, "Чебурек");
  assert.equal(shown.grams, 180);
  assert.equal(shown.unit, "г");
});

const CHEB_LOG = "Я съел чебурек с фаршем индейки";
const CHEB_BULLETS = `Запиши чебурек в дневник?
- Калорийность: примерно 300 ккал
- Белки: около 20 г
- Жиры: около 15 г
- Углеводы: около 25 г`;

test("пункты КБЖУ не становятся названием блюда", () => {
  assert.equal(isNutrientLabelName("Калории"), true);
  assert.equal(isNutrientLabelName("Калорийность"), true);
  assert.equal(isNutrientLabelName("Белки"), true);
  assert.equal(isNutrientLabelName("Жиры"), true);
  assert.equal(isNutrientLabelName("Углеводы"), true);
  assert.equal(isNutrientLabelName("Чебурек с фаршем индейки"), false);
  assert.equal(isNutrientLabelName("Жирная сметана"), false);

  const parsed = parseStructuredMealsFromText(CHEB_BULLETS);
  assert.equal(parsed.length, 0);

  const draft = heuristicRepairFromDraftReply(CHEB_LOG, CHEB_BULLETS);
  const meal = draft?.meals?.[0];
  assert.ok(meal);
  assert.equal(meal.name, "Чебурек с фаршем индейки");
  assert.equal(meal.kcal, 300);
  assert.equal(meal.protein, 20);
  assert.equal(meal.fat, 15);
  assert.equal(meal.carbs, 25);
  assert.equal(quickMacroLine(meal), "Б 20 · Ж 15 · У 25");
  const shown = splitQuickPortion(enrichQuickMealsFromText([meal], CHEB_LOG)[0]!.name);
  assert.equal(shown.base, "Чебурек с фаршем индейки");
});

test("«белки 15 г, жиры 15 г, углеводы 20 г» попадают в карточку", () => {
  const a = heuristicRepairFromProseKcal(
    "Я съела чебурек с фаршем индейки",
    "примерно 280 ккал, белки 15 г, жиры 15 г, углеводы 20 г",
  );
  const meal = a?.meals?.[0];
  assert.equal(meal?.name, "Чебурек с фаршем индейки");
  assert.equal(meal?.kcal, 280);
  assert.equal(meal?.protein, 15);
  assert.equal(meal?.fat, 15);
  assert.equal(meal?.carbs, 20);
});

test("«я съел / запиши / добавь» не входят в название", () => {
  assert.equal(dishNameFromUserLog("Я съел чебурек с фаршем индейки"), "Чебурек с фаршем индейки");
  assert.equal(dishNameFromUserLog("Я съела чебурек"), "Чебурек");
  assert.equal(dishNameFromUserLog("запиши чебурек с фаршем индейки"), "Чебурек с фаршем индейки");
  assert.equal(dishNameFromUserLog("добавь чебурек в дневник"), "Чебурек");
});

test("ответ модели «Калории» с нулевым БЖУ заменяется текстом черновика", () => {
  const saved = salvageNutrientLabelMeals(
    {
      apply: true,
      meals: [{ name: "Калории", kcal: 300, protein: 0, fat: 0, carbs: 0 }],
    },
    CHEB_LOG,
    CHEB_BULLETS,
  );
  const meal = saved?.meals?.[0];
  assert.equal(meal?.name, "Чебурек с фаршем индейки");
  assert.equal(meal?.kcal, 300);
  assert.equal(meal?.protein, 20);
  assert.equal(meal?.fat, 15);
  assert.equal(meal?.carbs, 25);
  assert.equal(saved?.meals?.length, 1);
});

const SYRNIKI_USER =
  "Я съел на завтрак 3 сырника с топпингом без сахара, желе из ряженки";
const SYRNIKI_REPLY = [
  "- Сырники (3 шт. ≈ 150 г): примерно 300 ккал, белки 20 г, жиры 15 г, углеводы 25 г",
  "- Топпинг без сахара (≈ 30 г): примерно 50 ккал, белки 1 г, жиры 1 г, углеводы 10 г",
  "- Желе из ряженки: исключено из-за ваших предпочтений",
].join("\n");

test("сырники: все блюда, граммы из ≈ и ккал этой порции", () => {
  assert.equal(parsePortionGramsFromMessage("Сырники (3 шт. ≈ 150 г)"), 150);
  assert.equal(parsePortionGramsFromMessage("Топпинг без сахара (≈ 30 г)"), 30);

  const meals = parseStructuredMealsFromText(SYRNIKI_REPLY);
  assert.equal(meals.length, 3, "исключённое из-за предпочтений тоже записывается");

  const syr = meals.find((m) => /сырник/i.test(m.name));
  const top = meals.find((m) => /топпинг/i.test(m.name));
  const jelly = meals.find((m) => /желе/i.test(m.name));
  assert.ok(syr && top && jelly);
  assert.equal(syr.kcal, 300);
  assert.equal(syr.protein, 20);
  assert.equal(syr.fat, 15);
  assert.equal(syr.carbs, 25);
  assert.equal(top.kcal, 50);
  assert.equal(top.protein, 1);
  assert.equal(top.fat, 1);
  assert.equal(top.carbs, 10);
  assert.ok((jelly.kcal ?? 0) > 0);
  assert.match(jelly.name, /желе из ряженки/i);

  const card = enrichQuickMealsFromText(meals, "к подтверждению: сырники, топпинг");
  const syrCard = card.find((m) => /сырник/i.test(m.name))!;
  const topCard = card.find((m) => /топпинг/i.test(m.name))!;
  const jellyCard = card.find((m) => /желе/i.test(m.name))!;
  assert.equal(splitQuickPortion(syrCard.name).grams, 150);
  assert.equal(syrCard.kcal, 300);
  assert.equal(syrCard.protein, 20);
  assert.equal(splitQuickPortion(topCard.name).grams, 30);
  assert.equal(topCard.kcal, 50);
  assert.equal(splitQuickPortion(jellyCard.name).grams, 150);
  assert.doesNotMatch(syrCard.name, /100\s*г/);
  assert.doesNotMatch(topCard.name, /100\s*г/);

  const multi = heuristicRepairMultiDishActions(SYRNIKI_USER, SYRNIKI_REPLY);
  assert.equal(multi?.meals?.length, 3);
  assert.ok(multi!.meals!.every((m) => m.note === "завтрак"));

  const fixed = preferMultiDishActions(SYRNIKI_USER, SYRNIKI_REPLY, {
    apply: true,
    meals: [
      { name: "сырники (100 г)", kcal: 300, protein: 20, fat: 15, carbs: 25, note: "завтрак" },
      { name: "топпинг без сахара (100 г)", kcal: 50, protein: 1, fat: 1, carbs: 10, note: "завтрак" },
    ],
  });
  assert.equal(fixed?.meals?.length, 3);
  const fixedSyr = fixed!.meals!.find((m) => /сырник/i.test(m.name))!;
  const fixedTop = fixed!.meals!.find((m) => /топпинг/i.test(m.name))!;
  const fixedJelly = fixed!.meals!.find((m) => /желе/i.test(m.name))!;
  assert.equal(splitQuickPortion(fixedSyr.name).grams, 150);
  assert.equal(fixedSyr.kcal, 300);
  assert.equal(splitQuickPortion(fixedTop.name).grams, 30);
  assert.equal(fixedTop.kcal, 50);
  assert.match(fixedJelly.name, /желе/i);
  assert.ok((fixedJelly.kcal ?? 0) > 0);
});

test("карточка не подменяет ≈-граммы на 100 г и не пересчитывает ккал", () => {
  const raw = enrichQuickMealsFromText(
    [
      { name: "Сырники (3 шт. ≈ 150 г)", kcal: 300, protein: 20, fat: 15, carbs: 25 },
      { name: "Топпинг без сахара (≈ 30 г)", kcal: 50, protein: 1, fat: 1, carbs: 10 },
    ],
    "",
  );
  assert.equal(splitQuickPortion(raw[0]!.name).grams, 150);
  assert.equal(splitQuickPortion(raw[0]!.name).base, "Сырники (3 шт)");
  assert.equal(raw[0]!.kcal, 300);
  assert.equal(raw[0]!.protein, 20);
  assert.equal(splitQuickPortion(raw[1]!.name).grams, 30);
  assert.equal(splitQuickPortion(raw[1]!.name).base, "Топпинг без сахара");
  assert.equal(raw[1]!.kcal, 50);
});

const REPEAT_REPLY = [
  "Отмечаю ваш завтрак:",
  "",
  "- Сырники (3 шт. ≈ 150 г): примерно 300 ккал, белки 20 г, жиры 15 г, углеводы 25 г",
  "- Топпинг без сахара (≈ 30 г): примерно 50 ккал, белки 1 г, жиры 1 г, углеводы 10 г",
  "- Желе из ряженки: 100 ккал, белки 5 г, жиры 3 г, углеводы 10 г (учтено полностью)",
  "",
  "Завтрак — добавьте в дневник, подтверждая ниже.",
].join("\n");

test("повтор в том же чате: карточка содержит все блюда текущего ответа", () => {
  const parsed = parseStructuredMealsFromText(REPEAT_REPLY);
  assert.equal(parsed.length, 3);
  const jellyParsed = parsed.find((m) => /желе/i.test(m.name))!;
  assert.equal(jellyParsed.kcal, 100);
  assert.equal(jellyParsed.protein, 5);
  assert.equal(jellyParsed.fat, 3);
  assert.equal(jellyParsed.carbs, 10);

  // Прошлая карточка уже «записала» сырники и топпинг — модель кладёт в JSON только желе
  // и подставляет табличную оценку 85 ккал вместо 100 из текста.
  const modelDeduped = {
    apply: true as const,
    summary: "к подтверждению: Желе из ряженки",
    meals: [{ name: "Желе из ряженки", kcal: 85, protein: 4, fat: 5, carbs: 6, note: "завтрак" }],
  };
  const fixed = preferMultiDishActions(SYRNIKI_USER, REPEAT_REPLY, modelDeduped);
  assert.equal(fixed?.meals?.length, 3);
  const syr = fixed!.meals!.find((m) => /сырник/i.test(m.name))!;
  const top = fixed!.meals!.find((m) => /топпинг/i.test(m.name))!;
  const jelly = fixed!.meals!.find((m) => /желе/i.test(m.name))!;
  assert.equal(splitQuickPortion(syr.name).grams, 150);
  assert.equal(syr.kcal, 300);
  assert.equal(syr.protein, 20);
  assert.equal(syr.fat, 15);
  assert.equal(syr.carbs, 25);
  assert.equal(splitQuickPortion(top.name).grams, 30);
  assert.equal(top.kcal, 50);
  assert.equal(top.protein, 1);
  assert.equal(top.fat, 1);
  assert.equal(top.carbs, 10);
  assert.equal(jelly.kcal, 100);
  assert.equal(jelly.protein, 5);
  assert.equal(jelly.fat, 3);
  assert.equal(jelly.carbs, 10);

  const card = enrichQuickMealsFromText(fixed!.meals!, fixed!.summary ?? "");
  const jellyCard = card.find((m) => /желе/i.test(m.name))!;
  assert.equal(jellyCard.kcal, 100);
  assert.equal(jellyCard.protein, 5);
  assert.equal(jellyCard.fat, 3);
  assert.equal(jellyCard.carbs, 10);

  // То же сообщение ещё раз: история чата снова не должна схлопнуть карточку до одного блюда.
  const again = preferMultiDishActions(SYRNIKI_USER, REPEAT_REPLY, modelDeduped);
  assert.equal(again?.meals?.length, 3);
  assert.equal(again!.meals!.find((m) => /желе/i.test(m.name))!.kcal, 100);
  assert.ok(again!.meals!.some((m) => /сырник/i.test(m.name) && m.kcal === 300));
  assert.ok(again!.meals!.some((m) => /топпинг/i.test(m.name) && m.kcal === 50));
});

test("время и приём у нового продукта — добавление, не правка слота", () => {
  const protein = "я выпил 70г протеина на перекус в 10:30";
  const isolate = "Я выпил 70г протеина изолята на перекус в 10:30";
  const eggs = "съел 2 яйца на завтрак в 8";
  for (const phrase of [protein, isolate, eggs]) {
    assert.equal(messageLogsNewEatenFood(phrase), true, phrase);
    assert.equal(heuristicRepairSlotEditActions(phrase), null, phrase);
    assert.equal(heuristicRepairPortionPatchActions(phrase), null, phrase);
  }

  const drank = heuristicRepairWriteActions(protein);
  assert.ok(drank?.meals?.length);
  assert.equal(drank?.patchMeals, undefined);
  assert.match(drank!.meals![0]!.name, /протеин/i);
  assert.match(drank!.meals![0]!.name, /70/);
  assert.equal(drank!.meals![0]!.note, "перекус");

  const isolateMeal = heuristicRepairWriteActions(isolate);
  assert.match(isolateMeal!.meals![0]!.name, /протеин/i);
  assert.equal(isolateMeal!.meals![0]!.note, "перекус");
  assert.equal(isolateMeal?.patchMeals, undefined);

  const eggMeal = heuristicRepairWriteActions(eggs);
  assert.match(eggMeal!.meals![0]!.name, /яйц/i);
  assert.match(eggMeal!.meals![0]!.name, /2 шт/);
  assert.equal(eggMeal!.meals![0]!.note, "завтрак");
  assert.equal(eggMeal?.patchMeals, undefined);
});

test("перенеси перекус на 11:00 — правка времени, не новое блюдо", () => {
  const phrase = "перенеси перекус на 11:00";
  assert.equal(messageLogsNewEatenFood(phrase), false);
  assert.equal(messageHasExplicitMealEdit(phrase), true);
  const actions = heuristicRepairSlotEditActions(phrase);
  assert.equal(actions?.meals, undefined);
  assert.equal(actions?.patchMeals?.[0]?.mealType, "SNACK");
  assert.equal(actions?.patchMeals?.[0]?.time, "11:00");
  assert.match(actions?.summary ?? "", /перекус → 11:00/);
});

test("исправь вес протеина на 50 г — правка порции, не новое блюдо", () => {
  const phrase = "исправь вес протеина на 50 г";
  assert.equal(messageLogsNewEatenFood(phrase), false);
  assert.equal(messageHasExplicitMealEdit(phrase), true);
  assert.equal(heuristicRepairSlotEditActions(phrase), null);
  assert.equal(heuristicRepairWriteActions(phrase), null);
  const actions = heuristicRepairPortionPatchActions(phrase);
  assert.equal(actions?.meals, undefined);
  assert.equal(actions?.patchMeals?.[0]?.portionGrams, 50);
  assert.match(actions?.patchMeals?.[0]?.match ?? "", /протеин/i);
});

test("модель вернула и правку, и продукт — остаётся карточка добавления", () => {
  const fixed = preferSlotEditActions("я выпил 70г протеина на перекус в 10:30", {
    apply: true,
    summary: "перекус → 10:30 — подтверди",
    meals: [{ name: "Протеин изолят (70 г)", kcal: 259, protein: 60, note: "перекус", time: "10:30" }],
    patchMeals: [{ match: "перекус", mealType: "SNACK", time: "10:30" }],
  });
  assert.equal(fixed?.patchMeals, undefined);
  assert.match(fixed?.meals?.[0]?.name ?? "", /протеин/i);
  assert.doesNotMatch(fixed?.summary ?? "", /→/);
});
