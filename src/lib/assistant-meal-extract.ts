/**
 * Извлечение блюд из ответа чата: function calling, а если API его не принял —
 * отдельный вызов со строгим JSON. Валидация одна и та же.
 */

import { completeChat, completeFunctionCall } from "@/lib/ai/gigachat";
import { GigaChatFunctionUnsupportedError } from "@/lib/ai/gigachat-errors";

const EXTRACT_SYSTEM = [
  "Ты извлекаешь уже съеденные блюда для карточки дневника Calorie Vision.",
  "Верни только функцию extract_meals или, если функций нет, один JSON-объект {\"meals\":[...]}.",
  "Каждое блюдо: name, grams, unit, kcal, protein, fat, carbs, mealSlot.",
  "grams — число порции. Если порция нигде не названа, grams=0. Нельзя подставлять 100.",
  "unit: \"г\", \"мл\" или \"шт\". Если grams=0, unit всё равно укажи (обычно \"г\").",
  "kcal и БЖУ — на названную порцию, не на 100 г и не пересчитывай.",
  "Если калорий или БЖУ в тексте нет, поставь 0. Ноль значит «не сказано», а не измеренный ноль. Не выдумывай состав бренда.",
  "mealSlot: BREAKFAST, LUNCH, DINNER, SNACK или null, если приём не ясен.",
  "Несколько блюд — несколько объектов. Строку «исключено из-за предпочтений» всё равно включи, если блюдо уже съели: имя — еда, не слово «исключено».",
  "«(учтено полностью)» не входит в name. Ккал и БЖУ бери из этой строки.",
  "Имя не может быть «Калории», «Белки», «Жиры» или «Углеводы».",
  "Если еду не записывают (вопрос, тренировка, вода, вес, явная правка «перенеси/исправь/измени») — meals: [].",
  "Время («в 10:30», «в 8») и приём («на перекус», «на завтрак») не отменяют блюдо. «Выпил 70 г протеина на перекус в 10:30» и «съел 2 яйца на завтрак в 8» — это meals, mealSlot по приёму.",
].join("\n");

export const MEAL_EXTRACT_FUNCTION = {
  name: "extract_meals",
  description: "Список съеденных блюд со строгими полями порции и КБЖУ.",
  parameters: {
    type: "object",
    additionalProperties: false,
    required: ["meals"],
    properties: {
      meals: {
        type: "array",
        maxItems: 12,
        items: {
          type: "object",
          additionalProperties: false,
          required: ["name", "grams", "unit", "kcal", "protein", "fat", "carbs", "mealSlot"],
          properties: {
            name: { type: "string" },
            grams: { type: "number", description: "0, если порция не названа. Не подставляй 100." },
            unit: { type: "string", enum: ["г", "мл", "шт"] },
            kcal: { type: "number", description: "0, если калорий в тексте нет. Не выдумывай." },
            protein: { type: "number", description: "0, если белок в тексте не назван." },
            fat: { type: "number", description: "0, если жир в тексте не назван." },
            carbs: { type: "number", description: "0, если углеводы в тексте не названы." },
            mealSlot: {
              type: "string",
              enum: ["BREAKFAST", "LUNCH", "DINNER", "SNACK", ""],
              description: "Пустая строка, если слот неясен.",
            },
          },
        },
      },
    },
  },
} as const;

export async function extractMealsFromTurn(input: {
  userMessage: string;
  assistantReply: string;
}): Promise<unknown> {
  const user = [
    `Запрос пользователя:\n${input.userMessage.slice(0, 2000)}`,
    "",
    `Ответ ассистента:\n${input.assistantReply.slice(0, 4000)}`,
  ].join("\n");
  const messages = [
    { role: "system", content: EXTRACT_SYSTEM },
    { role: "user", content: user },
  ];

  try {
    return await completeFunctionCall(messages, MEAL_EXTRACT_FUNCTION, 0.1);
  } catch (error) {
    if (!(error instanceof GigaChatFunctionUnsupportedError)) throw error;
  }

  return completeChat(
    [
      {
        role: "system",
        content: `${EXTRACT_SYSTEM}\nВерни только JSON {"meals":[...]} без markdown и без текста вокруг. mealSlot: BREAKFAST|LUNCH|DINNER|SNACK или null.`,
      },
      { role: "user", content: user },
    ],
    0.1,
    { retries: 1 },
  );
}
