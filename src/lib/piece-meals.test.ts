/**
 * Штучные блюда в чате: нули схемы извлечения не должны оставлять карточку пустой.
 * КБЖУ — оценка справочника на средний вес штуки. Непонятное блюдо остаётся пустым.
 */

import assert from "node:assert/strict";
import { test } from "node:test";
import { runAssistantMealFixture } from "./assistant-meal-pipeline.ts";
import { foodConfirmFromQuickMeal, foodConfirmNutritionNote, prepareFoodConfirmSave } from "./food-confirm.ts";
import { atwaterKcal } from "./nutrition-consistency.ts";

process.env.ASSISTANT_MEAL_TELEMETRY = "0";

type ExtractMeal = {
  name: string;
  count: number;
};

function zerosExtract(meal: ExtractMeal) {
  return async () => ({
    meals: [
      {
        name: meal.name,
        grams: meal.count,
        unit: "шт",
        kcal: 0,
        protein: 0,
        fat: 0,
        carbs: 0,
        mealSlot: "",
      },
    ],
  });
}

async function cardFromExtract(user: string, meal: ExtractMeal) {
  const out = await runAssistantMealFixture({
    rawReply: [
      "Отмечаю в дневнике питания.",
      `- ${meal.name} (${meal.count} шт.)`,
      "Нажмите «Подтвердить».",
    ].join("\n"),
    userMessage: user,
    today: "2026-11-22",
    date: "2026-11-22",
    extractMeals: zerosExtract(meal),
  });
  assert.equal(out.card.length, 1, user);
  return foodConfirmFromQuickMeal(out.card[0]!);
}

test("3 блинчика с творогом: КБЖУ из среднего веса штуки, не пустая карточка", async () => {
  const user = "Я съел 3 блинчика с творогом";
  const dish = await cardFromExtract(user, { name: "Блинчик с творогом", count: 3 });
  assert.equal(dish.nutritionBasis, "estimate");
  assert.equal(foodConfirmNutritionNote(dish), "Типовая оценка по справочнику");
  assert.match(dish.name, /блин/i);
  assert.match(dish.name, /3\s*шт/);
  assert.equal(dish.unit, "г");
  assert.ok(dish.grams != null && dish.grams >= 210 && dish.grams <= 270, `граммы ${dish.grams}`);
  assert.ok(dish.kcal != null && dish.kcal >= 450 && dish.kcal <= 600, `ккал ${dish.kcal}`);
  const perPiece = dish.kcal! / 3;
  assert.ok(perPiece >= 150 && perPiece <= 200, `ккал/шт ${perPiece}`);
  assert.ok((dish.protein ?? 0) > 0);
  assert.ok((dish.fat ?? 0) > 0);
  assert.ok((dish.carbs ?? 0) > 0);
  const expected = atwaterKcal(dish.protein ?? 0, dish.fat ?? 0, dish.carbs ?? 0);
  assert.ok(Math.abs(dish.kcal! - expected) <= 1, `${dish.kcal} vs ${expected}`);
  const saved = prepareFoodConfirmSave([dish]);
  assert.equal(saved.ok, true);

  const offline = await runAssistantMealFixture({
    rawReply: "Отмечаю в дневнике питания.",
    userMessage: user,
    today: "2026-11-22",
    date: "2026-11-22",
  });
  assert.equal(offline.card.length, 1);
  assert.ok((offline.card[0]!.kcal ?? 0) >= 450);
  assert.match(offline.card[0]!.name, /3\s*шт/);
});

const PIECE_PHRASES: Array<{
  user: string;
  name: string;
  count: number;
  grams: [number, number];
  kcal: [number, number];
}> = [
  { user: "Я съел три блинчика с творогом", name: "Блинчики с творогом", count: 3, grams: [210, 270], kcal: [450, 600] },
  { user: "съел 2 блинчика", name: "Блинчик", count: 2, grams: [80, 140], kcal: [160, 320] },
  { user: "съел 3 сырника", name: "Сырник", count: 3, grams: [180, 240], kcal: [400, 560] },
  { user: "съел 2 котлеты", name: "Котлеты", count: 2, grams: [160, 280], kcal: [300, 600] },
  { user: "съел 2 куриные котлеты", name: "Куриная котлета", count: 2, grams: [200, 280], kcal: [400, 650] },
  { user: "съел 2 пирожка с мясом", name: "Пирожок с мясом", count: 2, grams: [150, 220], kcal: [450, 700] },
  { user: "Я съел 4 варёных яйца", name: "Вареные яйца", count: 4, grams: [200, 240], kcal: [280, 360] },
  { user: "съел 2 чебурека", name: "Чебурек", count: 2, grams: [200, 280], kcal: [600, 900] },
  { user: "съел 10 пельменей", name: "Пельмени", count: 10, grams: [120, 180], kcal: [200, 400] },
  { user: "съел 2 сосиски", name: "Сосиска", count: 2, grams: [160, 240], kcal: [400, 600] },
  { user: "съел 2 пончика", name: "Пончик", count: 2, grams: [120, 160], kcal: [450, 650] },
  { user: "съел 2 вареника с творогом", name: "Вареник с творогом", count: 2, grams: [40, 70], kcal: [60, 160] },
  { user: "съел 2 яблока", name: "Яблоко", count: 2, grams: [300, 400], kcal: [150, 250] },
  { user: "съел банан", name: "Банан", count: 1, grams: [100, 140], kcal: [90, 150] },
  { user: "съел 2 драника", name: "Драник", count: 2, grams: [100, 160], kcal: [150, 280] },
  { user: "съел 2 круассана", name: "Круассан", count: 2, grams: [110, 150], kcal: [450, 650] },
  { user: "съел 2 ватрушки с творогом", name: "Ватрушка с творогом", count: 2, grams: [160, 240], kcal: [400, 650] },
  { user: "съел шаурму", name: "Шаурма", count: 1, grams: [250, 320], kcal: [450, 600] },
  { user: "съел 3 оладьи", name: "Оладьи", count: 3, grams: [120, 180], kcal: [240, 360] },
];

test("похожие штучные фразы получают оценку, а не пустые КБЖУ", async () => {
  assert.ok(PIECE_PHRASES.length >= 15);
  for (const phrase of PIECE_PHRASES) {
    const dish = await cardFromExtract(phrase.user, { name: phrase.name, count: phrase.count });
    assert.equal(dish.nutritionBasis, "estimate", phrase.user);
    assert.equal(foodConfirmNutritionNote(dish), "Типовая оценка по справочнику", phrase.user);
    assert.notEqual(dish.kcal, 0, phrase.user);
    assert.ok(dish.kcal != null && dish.kcal >= phrase.kcal[0] && dish.kcal <= phrase.kcal[1], `${phrase.user}: ккал ${dish.kcal}`);
    assert.ok(
      dish.grams != null && dish.grams >= phrase.grams[0] && dish.grams <= phrase.grams[1],
      `${phrase.user}: граммы ${dish.grams}`,
    );
    assert.equal(prepareFoodConfirmSave([dish]).ok, true, phrase.user);
  }
});

test("непонятное штучное блюдо остаётся пустым и не получает нули", async () => {
  const dish = await cardFromExtract("Я съел 2 штуки кварцевого мусса zzq", {
    name: "Кварцевый мусс zzq",
    count: 2,
  });
  assert.equal(dish.nutritionBasis, "unknown");
  assert.equal(dish.kcal, null);
  assert.equal(dish.protein, null);
  assert.equal(dish.fat, null);
  assert.equal(dish.carbs, null);
  assert.equal(foodConfirmNutritionNote(dish), "КБЖУ не определены — нужно уточнить");
  assert.equal(prepareFoodConfirmSave([dish]).ok, false);
});

test("названные пользователем ккал штучного блюда не затираются справочником", async () => {
  const out = await runAssistantMealFixture({
    rawReply: "Блинчик с творогом (3 шт.): примерно 400 ккал.",
    userMessage: "Я съел 3 блинчика с творогом, примерно 400 ккал",
    today: "2026-11-22",
    date: "2026-11-22",
    extractMeals: async () => ({
      meals: [
        {
          name: "Блинчик с творогом",
          grams: 3,
          unit: "шт",
          kcal: 400,
          protein: 0,
          fat: 0,
          carbs: 0,
          mealSlot: "",
        },
      ],
    }),
  });
  assert.equal(out.card.length, 1);
  assert.equal(out.card[0]!.kcal, 400);
});
