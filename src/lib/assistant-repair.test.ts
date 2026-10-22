import assert from "node:assert/strict";
import { test } from "node:test";
import {
  actionsHaveWritablePayload,
  assistantWroteFlag,
  assistantWriteMissNote,
  extractActionsJson,
  heuristicRepairMultiDishActions,
  heuristicRepairPortionPatchActions,
  heuristicRepairSlotEditActions,
  heuristicRepairWriteActions,
  messageLooksLikeMultiDish,
  needsWriteRepair,
  parsePortionGramsFromMessage,
  parseStructuredMealsFromText,
  preferMultiDishActions,
  preferSlotEditActions,
  pruneNoopAssistantActions,
} from "./assistant-repair.ts";
import { userWantsWrite } from "./assistant-intent.ts";

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
