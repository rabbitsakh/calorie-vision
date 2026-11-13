/**
 * Б1: корпус фраз через весь конвейер карточки.
 * Числа «подушечки» / «салат» взяты из выгрузки дневника (только имя и КБЖУ).
 */

import assert from "node:assert/strict";
import { test } from "node:test";
import {
  hashMealPhrase,
  logAssistantMealParse,
  runAssistantMealFixture,
  type AssistantMealParseEvent,
} from "./assistant-meal-pipeline.ts";
import { splitQuickPortion } from "./quick-log.ts";

process.env.ASSISTANT_MEAL_TELEMETRY = "0";

function fence(actions: unknown): string {
  return `\n\n\`\`\`cv-actions\n${JSON.stringify(actions)}\n\`\`\``;
}

function gramsOf(name: string): number | null {
  return splitQuickPortion(name).grams;
}

test("чебурек: пункты КБЖУ не становятся именем и не получают молчаливые 100 г", async () => {
  const user = "Я съел чебурек с фаршем индейки";
  const raw = `Запиши чебурек в дневник?
- Калорийность: примерно 300 ккал
- Белки: около 20 г
- Жиры: около 15 г
- Углеводы: около 25 г`;
  const out = await runAssistantMealFixture({ rawReply: raw, userMessage: user });
  assert.equal(out.card.length, 1);
  const meal = out.card[0]!;
  assert.equal(meal.name, "Чебурек с фаршем индейки");
  assert.equal(meal.kcal, 300);
  assert.equal(meal.protein, 20);
  assert.equal(meal.fat, 15);
  assert.equal(meal.carbs, 25);
  assert.equal(gramsOf(meal.name), null);
  assert.equal(out.payload[0]?.portionGrams, undefined);
  assert.equal(out.payload[0]?.calories, 300);
  assert.equal(out.parse.shorterThanProse, false);
});

test("явные 100 г в JSON не затираются текстом «≈ 150 г»", async () => {
  const user = "Я съел чебурек";
  const prose =
    "Чебурек (≈ 150 г): примерно 300 ккал, белки 20 г, жиры 15 г, углеводы 25 г. Подтверждайте запись в дневник.";
  const raw =
    prose +
    fence({
      apply: true,
      meals: [{ name: "Чебурек (100 г)", kcal: 300, protein: 20, fat: 15, carbs: 25 }],
    });
  const out = await runAssistantMealFixture({ rawReply: raw, userMessage: user });
  assert.equal(out.card.length, 1);
  assert.equal(gramsOf(out.card[0]!.name), 100);
  assert.equal(out.card[0]!.kcal, 300);
  assert.equal(out.payload[0]?.portionGrams, 100);
});

test("сырники: три блюда, граммы из «≈», желе не выкинуто", async () => {
  const user = "Я съел на завтрак 3 сырника с топпингом без сахара, желе из ряженки";
  const raw = [
    "- Сырники (3 шт. ≈ 150 г): примерно 300 ккал, белки 20 г, жиры 15 г, углеводы 25 г",
    "- Топпинг без сахара (≈ 30 г): примерно 50 ккал, белки 1 г, жиры 1 г, углеводы 10 г",
    "- Желе из ряженки: исключено из-за ваших предпочтений",
  ].join("\n");
  const out = await runAssistantMealFixture({ rawReply: raw, userMessage: user });
  assert.equal(out.card.length, 3);
  const syr = out.card.find((m) => /сырник/i.test(m.name))!;
  const top = out.card.find((m) => /топпинг/i.test(m.name))!;
  const jelly = out.card.find((m) => /желе/i.test(m.name))!;
  assert.equal(gramsOf(syr.name), 150);
  assert.equal(syr.kcal, 300);
  assert.equal(gramsOf(top.name), 30);
  assert.equal(top.kcal, 50);
  assert.match(jelly.name, /желе из ряженки/i);
  assert.ok((jelly.kcal ?? 0) > 0);
  assert.equal(out.payload.find((row) => /сырник/i.test(row.dishName))?.portionGrams, 150);
  assert.equal(out.payload.find((row) => /топпинг/i.test(row.dishName))?.portionGrams, 30);
});

test("повтор в чате: JSON с одним блюдом не обрезает текущий ответ", async () => {
  const user = "Я съел на завтрак 3 сырника с топпингом без сахара, желе из ряженки";
  const prose = [
    "Отмечаю ваш завтрак:",
    "- Сырники (3 шт. ≈ 150 г): примерно 300 ккал, белки 20 г, жиры 15 г, углеводы 25 г",
    "- Топпинг без сахара (≈ 30 г): примерно 50 ккал, белки 1 г, жиры 1 г, углеводы 10 г",
    "- Желе из ряженки: 100 ккал, белки 5 г, жиры 3 г, углеводы 10 г (учтено полностью)",
  ].join("\n");
  const raw =
    prose +
    fence({
      apply: true,
      summary: "к подтверждению: Желе из ряженки",
      meals: [{ name: "Желе из ряженки", kcal: 85, protein: 4, fat: 5, carbs: 6, note: "завтрак" }],
    });
  const out = await runAssistantMealFixture({ rawReply: raw, userMessage: user });
  assert.equal(out.card.length, 3);
  const jelly = out.card.find((m) => /желе/i.test(m.name))!;
  assert.equal(jelly.kcal, 100);
  assert.equal(jelly.protein, 5);
  assert.notEqual(jelly.kcal, 85);
});

test("одна строка без цены остаётся на карточке и не попадает в сохранение", async () => {
  const user = "Я съел омлет и матча-латте с османтусом";
  const prose = [
    "- Омлет: 200 ккал, белки 14 г, жиры 15 г, углеводы 2 г",
    "- Матча-латте с османтусом",
  ].join("\n");
  const raw = prose + fence({ apply: true, meals: [{ name: "Омлет", kcal: 200, protein: 14, fat: 15, carbs: 2 }] });
  const out = await runAssistantMealFixture({ rawReply: raw, userMessage: user });
  assert.equal(out.card.length, 2);
  const drink = out.card.find((m) => /матча/i.test(m.name))!;
  assert.equal(drink.unparsed, true);
  assert.equal(drink.kcal, undefined);
  assert.equal(out.payload.length, 1);
  assert.match(out.payload[0]!.dishName, /омлет/i);
  assert.ok(out.parse.missed.some((name) => /матча/i.test(name)) || out.parse.unparsedCount >= 1);
});

test("«плюс» делит два блюда с ккал", async () => {
  const user = "Запиши омлет плюс гречка";
  const raw =
    "Омлет 200 ккал, белки 14 г, жиры 15 г, углеводы 2 г плюс гречка (180 г) 180 ккал, белки 6 г, жиры 2 г, углеводы 30 г. Подтверждайте запись в дневник.";
  const out = await runAssistantMealFixture({ rawReply: raw, userMessage: user });
  assert.equal(out.card.length, 2);
  assert.equal(out.card.find((m) => /омлет/i.test(m.name))?.kcal, 200);
  const buckwheat = out.card.find((m) => /греч/i.test(m.name))!;
  assert.equal(buckwheat.kcal, 180);
  assert.equal(gramsOf(buckwheat.name), 180);
  assert.equal(out.payload.find((row) => /греч/i.test(row.dishName))?.portionGrams, 180);
});

test("«а также» не склеивает борщ и хлеб", async () => {
  const user = "Я съел борщ, а также хлеб";
  const raw = [
    "- Борщ (300 г): 180 ккал, белки 8 г, жиры 6 г, углеводы 18 г",
    "- Хлеб (40 г): 90 ккал, белки 3 г, жиры 1 г, углеводы 16 г",
  ].join("\n");
  const out = await runAssistantMealFixture({ rawReply: raw, userMessage: user });
  assert.equal(out.card.length, 2);
  assert.equal(gramsOf(out.card.find((m) => /борщ/i.test(m.name))!.name), 300);
  assert.equal(gramsOf(out.card.find((m) => /хлеб/i.test(m.name))!.name), 40);
});

test("английское kcal читается как калории порции", async () => {
  const user = "Запиши овсянку";
  const raw = "- Овсянка (50 г): 180 kcal, protein 6 g, fat 3 g, carbs 30 g";
  const out = await runAssistantMealFixture({ rawReply: raw, userMessage: user });
  assert.equal(out.card.length, 1);
  assert.equal(out.card[0]!.kcal, 180);
  assert.equal(out.card[0]!.protein, 6);
  assert.equal(out.card[0]!.fat, 3);
  assert.equal(out.card[0]!.carbs, 30);
  assert.equal(gramsOf(out.card[0]!.name), 50);
  assert.equal(out.payload[0]?.portionGrams, 50);
});

test("порция 5 г не отбрасывается", async () => {
  const user = "Запиши масло сливочное 5 г";
  const raw = "- Масло сливочное (5 г): примерно 35 ккал, белки 0 г, жиры 4 г, углеводы 0 г";
  const out = await runAssistantMealFixture({ rawReply: raw, userMessage: user });
  assert.equal(out.card.length, 1);
  assert.equal(gramsOf(out.card[0]!.name), 5);
  assert.equal(out.card[0]!.kcal, 35);
  assert.equal(out.payload[0]?.portionGrams, 5);
});

test("4 варёных яйца остаются штуками, не одной порцией таблицы", async () => {
  const user = "Я съел 4 варёных яйца";
  const raw = "- 4 варёных яйца";
  const out = await runAssistantMealFixture({ rawReply: raw, userMessage: user });
  assert.equal(out.card.length, 1);
  assert.match(out.card[0]!.name, /4 шт/);
  assert.equal(out.card[0]!.kcal, 312);
});

test("редкое блюдо без граммов не получает (100 г)", async () => {
  const user = "Я съел матча-латте с сиропом османтуса";
  const raw = "Матча-латте с сиропом османтуса — примерно 140 ккал. Подтверждайте запись в дневник.";
  const out = await runAssistantMealFixture({ rawReply: raw, userMessage: user });
  assert.equal(out.card.length, 1);
  assert.doesNotMatch(out.card[0]!.name, /100\s*г/);
  assert.equal(gramsOf(out.card[0]!.name), null);
  assert.equal(out.card[0]!.kcal, 140);
  assert.equal(out.payload[0]?.portionGrams, undefined);
});

test("выгрузка: подушечки лавилето 50 г сохраняют порцию, а не 100 г", async () => {
  const user = "Запиши подушечки лавилето 50 г";
  const raw = "- подушечки лавилето (50 г): 215 ккал, белки 3.5 г, жиры 7.5 г, углеводы 33.5 г";
  const out = await runAssistantMealFixture({ rawReply: raw, userMessage: user });
  assert.equal(gramsOf(out.card[0]!.name), 50);
  assert.equal(out.card[0]!.kcal, 215);
  assert.equal(out.card[0]!.carbs, 33.5);
  assert.equal(out.payload[0]?.portionGrams, 50);
});

test("выгрузка: салат дальневосточный пишет 69 г и цифры ответа как есть", async () => {
  const user = "Я съел салат дальневосточный 69 г";
  const raw = "- Салат Дальневосточный (69 г): 445 ккал, белки 2.8 г, жиры 6.9 г, углеводы 0.7 г";
  const out = await runAssistantMealFixture({ rawReply: raw, userMessage: user });
  assert.equal(gramsOf(out.card[0]!.name), 69);
  assert.equal(out.card[0]!.kcal, 445);
  assert.equal(out.card[0]!.protein, 2.8);
  assert.equal(out.payload[0]?.portionGrams, 69);
  assert.equal(out.payload[0]?.calories, 445);
});

test("молоко 250 мл попадает в portionGrams", async () => {
  const user = "Запиши молоко 250 мл";
  const raw = "- Молоко (250 мл): 130 ккал, белки 7 г, жиры 6 г, углеводы 12 г";
  const out = await runAssistantMealFixture({ rawReply: raw, userMessage: user });
  assert.equal(splitQuickPortion(out.card[0]!.name).unit, "мл");
  assert.equal(out.payload[0]?.portionGrams, 250);
});

test("JSON «Калории» с нулевым БЖУ заменяется фразой пользователя", async () => {
  const user = "Я съел чебурек с фаршем индейки";
  const prose = `Запиши чебурек в дневник?
- Калорийность: примерно 300 ккал
- Белки: около 20 г
- Жиры: около 15 г
- Углеводы: около 25 г`;
  const raw =
    prose +
    fence({
      apply: true,
      meals: [{ name: "Калории", kcal: 300, protein: 0, fat: 0, carbs: 0 }],
    });
  const out = await runAssistantMealFixture({ rawReply: raw, userMessage: user });
  assert.equal(out.card.length, 1);
  assert.match(out.card[0]!.name, /чебурек/i);
  assert.equal(out.card[0]!.protein, 20);
  assert.notEqual(out.card[0]!.protein, 0);
});

test("grams и unit из JSON становятся порцией карточки", async () => {
  const user = "Запиши молоко";
  const raw = fence({
    apply: true,
    meals: [{ name: "Молоко", kcal: 130, protein: 7, fat: 6, carbs: 12, grams: 250, unit: "мл" }],
  });
  const out = await runAssistantMealFixture({ rawReply: raw, userMessage: user });
  assert.equal(out.card[0]!.name, "Молоко (250 мл)");
  assert.equal(out.payload[0]?.portionGrams, 250);
  assert.equal(out.card[0]!.kcal, 130);
});

test("второй вызов извлечения не заменяется разбором прозы", async () => {
  const user = "Запиши матча-латте с сиропом османтуса";
  const raw = "Не знаю, что ответить.";
  const out = await runAssistantMealFixture({
    rawReply: raw,
    userMessage: user,
    allowRepairLlm: true,
    completeRepairChat: async () =>
      JSON.stringify({
        apply: true,
        meals: [{ name: "Матча-латте с сиропом османтуса", kcal: 140, grams: 300, unit: "мл" }],
      }),
  });
  assert.equal(out.card.length, 1);
  assert.equal(out.card[0]!.kcal, 140);
  assert.equal(gramsOf(out.card[0]!.name), 300);
  assert.equal(splitQuickPortion(out.card[0]!.name).unit, "мл");
  assert.equal(out.parse.repairLlmUsed, true);
});

test("если в прозе больше блюд, чем в JSON, карточка помечает разрыв", async () => {
  const user = "Спасибо";
  const prose = [
    "- Сырники (150 г): 300 ккал, белки 20 г, жиры 15 г, углеводы 25 г",
    "- Топпинг (30 г): 50 ккал, белки 1 г, жиры 1 г, углеводы 10 г",
    "- Желе из ряженки: 100 ккал, белки 5 г, жиры 3 г, углеводы 10 г",
  ].join("\n");
  const raw = prose + fence({ apply: true, meals: [{ name: "Омлет", kcal: 200, protein: 14, fat: 15, carbs: 2 }] });
  const out = await runAssistantMealFixture({ rawReply: raw, userMessage: user });
  assert.equal(out.card.length, 1);
  assert.equal(out.actions?.mealGap?.prose, 3);
  assert.equal(out.actions?.mealGap?.card, 1);
});

test("структурное извлечение важнее regex и не подставляет 100 г", async () => {
  const user = "съел гречку и курицу";
  const raw =
    "Гречка 100 г и курица" +
    fence({ apply: true, meals: [{ name: "Гречка", kcal: 200 }] });
  const out = await runAssistantMealFixture({
    rawReply: raw,
    userMessage: user,
    extractMeals: async () => ({
      meals: [
        {
          name: "Гречка",
          grams: 180,
          unit: "г",
          kcal: 210,
          protein: 7,
          fat: 2,
          carbs: 40,
          mealSlot: "LUNCH",
        },
        {
          name: "Курица",
          grams: 0,
          unit: "г",
          kcal: 250,
          protein: 30,
          fat: 12,
          carbs: 0,
          mealSlot: null,
        },
      ],
    }),
  });
  assert.equal(out.parse.structuredExtractUsed, true);
  assert.equal(out.card.length, 2);
  const buckwheat = out.card.find((meal) => /греч/i.test(meal.name));
  const chicken = out.card.find((meal) => /куриц/i.test(meal.name));
  assert.equal(buckwheat?.grams, 180);
  assert.equal(buckwheat?.kcal, 210);
  assert.equal(buckwheat?.nutritionBasis, undefined);
  assert.equal(buckwheat?.mealSlot, "LUNCH");
  assert.equal(chicken?.grams, undefined);
  assert.equal(chicken?.carbs, 0);
  assert.equal(chicken?.kcal, 250);
  assert.equal(out.payload.find((row) => /куриц/i.test(row.dishName))?.portionGrams, undefined);
  assert.equal(out.payload.find((row) => /греч/i.test(row.dishName))?.portionGrams, 180);
});

test("если схема не сошлась, regex оставляет желе из «исключено» и «учтено полностью»", async () => {
  const user = "Я съел на завтрак 3 сырника с топпингом без сахара, желе из ряженки";
  const prose = [
    "- Сырники (3 шт. ≈ 150 г): примерно 300 ккал, белки 20 г, жиры 15 г, углеводы 25 г",
    "- Топпинг без сахара (≈ 30 г): примерно 50 ккал, белки 1 г, жиры 1 г, углеводы 10 г",
    "- Желе из ряженки: 100 ккал, белки 5 г, жиры 3 г, углеводы 10 г (учтено полностью)",
  ].join("\n");
  const raw = prose + fence({ apply: true, meals: [{ name: "Калории", kcal: 1 }] });
  const out = await runAssistantMealFixture({
    rawReply: raw,
    userMessage: user,
    extractMeals: async () => {
      throw new Error("gigachat down");
    },
  });
  assert.equal(out.parse.structuredExtractUsed, false);
  assert.equal(out.card.length, 3);
  const jelly = out.card.find((meal) => /желе/i.test(meal.name));
  assert.equal(jelly?.kcal, 100);
  assert.equal(jelly?.protein, 5);
});

test("лог неудачного разбора хранит хеш, а не фразу", () => {
  const phrase = "секретная фраза османтус и матча";
  const event: AssistantMealParseEvent = {
    jsonDishCount: 1,
    proseDishCount: 2,
    cardDishCount: 1,
    missed: ["Матча-латте"],
    unparsedCount: 1,
    repairLlmUsed: false,
    shorterThanProse: true,
    phraseHash: hashMealPhrase(phrase),
  };
  const lines: string[] = [];
  const orig = console.info;
  console.info = (...args: unknown[]) => {
    lines.push(args.map((part) => String(part)).join(" "));
  };
  const prev = process.env.ASSISTANT_MEAL_TELEMETRY;
  process.env.ASSISTANT_MEAL_TELEMETRY = "1";
  try {
    logAssistantMealParse(event);
  } finally {
    console.info = orig;
    process.env.ASSISTANT_MEAL_TELEMETRY = prev;
  }
  const blob = lines.join("\n");
  assert.match(blob, /\[assistant-meal\]/);
  assert.equal(blob.includes("османтус"), false);
  assert.match(blob, /Матча-латте/);
  assert.equal(event.phraseHash.length, 16);
  assert.notEqual(event.phraseHash, phrase);
});

test("выпил 70г протеина на перекус в 10:30 — карточка еды, не правка", async () => {
  const user = "я выпил 70г протеина на перекус в 10:30";
  const raw = [
    "Ок, кидаю в план.",
    "",
    "Вот что ты съел на перекус в 10:30:",
    "- Протеин изолят (70 г)",
    "",
    "Нажмите подтвердить, чтобы сохранить изменения.",
  ].join("\n");
  const out = await runAssistantMealFixture({ rawReply: raw, userMessage: user });
  assert.equal(out.actions?.patchMeals, undefined);
  assert.equal(out.card.length, 1);
  assert.match(out.card[0]!.name, /протеин/i);
  assert.equal(gramsOf(out.card[0]!.name), 70);
  assert.equal(out.card[0]!.kcal, 259);
  assert.equal(out.card[0]!.protein, 59.5);
  assert.equal(out.card[0]!.fat, 0.7);
  assert.equal(out.card[0]!.carbs, 2.1);
  assert.equal(out.card[0]!.nutritionBasis, "estimate");
  assert.equal(out.actions?.meals?.[0]?.note, "перекус");
  assert.equal(out.actions?.meals?.[0]?.time, "10:30");
  assert.doesNotMatch(out.reply, /кидаю в план/i);
  assert.match(out.reply, /Протеин изолят/);
});

test("съел 2 яйца на завтрак в 8 — добавление, не правка", async () => {
  const user = "съел 2 яйца на завтрак в 8";
  const raw = "Ок, кидаю в план. На завтрак два яйца.";
  const out = await runAssistantMealFixture({ rawReply: raw, userMessage: user });
  assert.equal(out.actions?.patchMeals, undefined);
  assert.ok(out.card.length >= 1);
  assert.match(out.card[0]!.name, /яйц/i);
  assert.equal(out.actions?.meals?.[0]?.note, "завтрак");
  assert.doesNotMatch(out.reply, /кидаю в план/i);
});

test("модель вернула правку слота вместо продукта — карточка добавления остаётся", async () => {
  const user = "Я выпил 70г протеина изолята на перекус в 10:30";
  const raw =
    "Ок, кидаю в план.\n\nВот что ты съел на перекус в 10:30:\n- Протеин изолят (70 г)" +
    fence({
      apply: true,
      summary: "перекус → 10:30 — подтверди",
      patchMeals: [{ match: "перекус", mealType: "SNACK", time: "10:30" }],
    });
  const out = await runAssistantMealFixture({ rawReply: raw, userMessage: user });
  assert.equal(out.actions?.patchMeals, undefined);
  assert.ok((out.actions?.meals?.length ?? 0) >= 1);
  assert.match(out.card[0]!.name, /протеин/i);
  assert.equal(out.actions?.meals?.[0]?.note, "перекус");
  assert.equal(out.actions?.meals?.[0]?.time, "10:30");
  assert.doesNotMatch(out.reply, /кидаю в план/i);
});

test("и правка, и продукты в одном ответе — показываем добавление", async () => {
  const user = "я выпил 70г протеина на перекус в 10:30";
  const raw =
    "Вот что записать в дневник." +
    fence({
      apply: true,
      summary: "перекус → 10:30 — подтверди",
      meals: [
        {
          name: "Протеин изолят",
          kcal: 259,
          protein: 60,
          fat: 1,
          carbs: 2,
          note: "перекус",
          time: "10:30",
        },
      ],
      patchMeals: [{ match: "перекус", mealType: "SNACK", time: "10:30" }],
    });
  const out = await runAssistantMealFixture({ rawReply: raw, userMessage: user });
  assert.equal(out.actions?.patchMeals, undefined);
  assert.match(out.card[0]!.name, /протеин/i);
  assert.equal(out.card[0]!.kcal, 259);
  assert.equal(out.actions?.meals?.[0]?.time, "10:30");
});

test("перенеси перекус и исправь вес остаются правками", async () => {
  const move = await runAssistantMealFixture({
    rawReply: "Переношу перекус.",
    userMessage: "перенеси перекус на 11:00",
  });
  assert.equal(move.card.length, 0);
  assert.equal(move.actions?.patchMeals?.[0]?.mealType, "SNACK");
  assert.equal(move.actions?.patchMeals?.[0]?.time, "11:00");

  const portion = await runAssistantMealFixture({
    rawReply: "Поправлю порцию.",
    userMessage: "исправь вес протеина на 50 г",
  });
  assert.equal(portion.card.length, 0);
  assert.equal(portion.actions?.meals, undefined);
  assert.equal(portion.actions?.patchMeals?.[0]?.portionGrams, 50);
});

test("нули КБЖУ протеина изолята становятся оценкой на 70 г, а не порцией 100 г", async () => {
  const user = "я выпил 70г протеина на перекус в 10:30";
  const raw = [
    "Вот твоя запись:",
    "- Протеин изолят (70 г)",
    "",
    "Нажмите подтвердить, чтобы сохранить изменения.",
  ].join("\n");
  const out = await runAssistantMealFixture({
    rawReply: raw,
    userMessage: user,
    extractMeals: async () => ({
      meals: [
        {
          name: "Протеин изолят",
          grams: 70,
          unit: "г",
          kcal: 0,
          protein: 0,
          fat: 0,
          carbs: 0,
          mealSlot: "SNACK",
        },
      ],
    }),
  });
  assert.equal(out.parse.structuredExtractUsed, true);
  assert.equal(out.card.length, 1);
  assert.equal(out.card[0]!.grams, 70);
  assert.equal(gramsOf(out.card[0]!.name), 70);
  assert.equal(out.card[0]!.kcal, 259);
  assert.equal(out.card[0]!.protein, 59.5);
  assert.equal(out.card[0]!.fat, 0.7);
  assert.equal(out.card[0]!.carbs, 2.1);
  assert.equal(out.card[0]!.nutritionBasis, "estimate");
  assert.equal(out.card[0]!.per100?.calories, 370);
  assert.equal(out.actions?.patchMeals, undefined);
  assert.equal(out.actions?.meals?.[0]?.note, "перекус");
  assert.equal(out.actions?.meals?.[0]?.time, "10:30");
});

test("сывороточный протеин без чисел в тексте тоже берётся из справочника", async () => {
  const out = await runAssistantMealFixture({
    rawReply: "Запиши: сывороточный протеин 30 г.",
    userMessage: "выпил 30 г сывороточного протеина",
    extractMeals: async () => ({
      meals: [
        {
          name: "Сывороточный протеин",
          grams: 30,
          unit: "г",
          kcal: 0,
          protein: 0,
          fat: 0,
          carbs: 0,
          mealSlot: "SNACK",
        },
      ],
    }),
  });
  assert.equal(out.card[0]!.grams, 30);
  assert.equal(out.card[0]!.kcal, 111);
  assert.equal(out.card[0]!.protein, 25.5);
  assert.equal(out.card[0]!.nutritionBasis, "estimate");
});

test("правка веса протеина не превращается в новую оценку КБЖУ", async () => {
  const out = await runAssistantMealFixture({
    rawReply: "Поправлю порцию.",
    userMessage: "исправь вес протеина на 50 г",
    extractMeals: async () => ({
      meals: [
        {
          name: "Протеин изолят",
          grams: 50,
          unit: "г",
          kcal: 0,
          protein: 0,
          fat: 0,
          carbs: 0,
          mealSlot: "SNACK",
        },
      ],
    }),
  });
  assert.equal(out.card.length, 0);
  assert.equal(out.actions?.meals, undefined);
  assert.equal(out.actions?.patchMeals?.[0]?.portionGrams, 50);
});

test("окорочок гриль без граммов: типовые 200 г и БЖУ, не 740 на 100 г", async () => {
  const out = await runAssistantMealFixture({
    userMessage: "Окорочок гриль куриный",
    rawReply: "Окорочок гриль куриный — примерно 740 ккал.",
  });
  assert.equal(out.card.length, 1);
  const meal = out.card[0]!;
  assert.equal(gramsOf(meal.name), 200);
  assert.equal(meal.kcal, 470);
  assert.equal(meal.protein, 44);
  assert.equal(meal.fat, 30);
  assert.equal(meal.carbs, 0);
  assert.equal(meal.per100?.calories, 235);
  assert.notEqual(meal.kcal, 740);
});

test("«(100 г) — 740 ккал» у окорочка не клеит ккал куска к 100 г", async () => {
  const out = await runAssistantMealFixture({
    userMessage: "Окорочок гриль куриный",
    rawReply:
      "Окорочок гриль куриный (100 г) — 740 ккал. С кожей калорийнее, без кожи легче.",
  });
  assert.equal(out.card.length, 1);
  const meal = out.card[0]!;
  assert.equal(gramsOf(meal.name), 200);
  assert.equal(meal.kcal, 470);
  assert.equal(meal.protein, 44);
  assert.equal(meal.fat, 30);
  assert.equal(meal.carbs, 0);
  assert.notEqual(gramsOf(meal.name), 100);
});

test("окорочок: «на 100 г 240» не затирает порцию ~300 г ≈ 740 ккал", async () => {
  const out = await runAssistantMealFixture({
    userMessage: "Окорочок гриль куриный",
    rawReply: "На 100 г 240 ккал, окорочок ~300 г ≈ 740 ккал.",
  });
  assert.equal(out.card.length, 1);
  const meal = out.card[0]!;
  assert.equal(gramsOf(meal.name), 300);
  assert.equal(meal.kcal, 740);
  assert.equal(meal.protein, 66);
  assert.equal(meal.fat, 45);
  assert.equal(meal.carbs, 0);
  assert.notEqual(meal.kcal, 240);
});
