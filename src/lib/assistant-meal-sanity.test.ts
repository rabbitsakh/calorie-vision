import assert from "node:assert/strict";
import { test } from "node:test";
import { resolveAssistantTurnActions } from "./assistant-meal-pipeline.ts";

function fence(actions: unknown): string {
  return `Записываю.\n\n\`\`\`cv-actions\n${JSON.stringify(actions)}\n\`\`\``;
}

test("текст: БЖУ на 100 мл пересчитываются на стакан, Атуотер только предупреждает", async () => {
  const milk = await resolveAssistantTurnActions({
    rawReply: fence({
      apply: true,
      meals: [
        {
          name: "Молоко (250 мл)",
          kcal: 130,
          protein: 2.8,
          fat: 2.5,
          carbs: 4.7,
          grams: 250,
          unit: "мл",
        },
      ],
    }),
    userMessage: "выпил молоко 250 мл",
    today: "2026-11-04",
    date: "2026-11-04",
    allowRepairLlm: false,
  });
  const row = milk.actions?.meals?.[0];
  assert.equal(row?.protein, 7);
  assert.equal(row?.fat, 6.3);
  assert.equal(row?.kcal, 130);
  assert.equal(row?.nutritionWarning, undefined);

  const gap = await resolveAssistantTurnActions({
    rawReply: fence({
      apply: true,
      meals: [{ name: "Гречка (200 г)", kcal: 500, protein: 6, fat: 2, carbs: 30, grams: 200 }],
    }),
    userMessage: "съел гречку 200 г",
    today: "2026-11-04",
    date: "2026-11-04",
    allowRepairLlm: false,
  });
  const buckwheat = gap.actions?.meals?.[0];
  assert.equal(buckwheat?.kcal, 500);
  assert.equal(buckwheat?.protein, 6);
  assert.match(buckwheat?.nutritionWarning ?? "", /не сходятся/);
});

test("текст: пиво без этанола поднимается по полосе крепости", async () => {
  const out = await resolveAssistantTurnActions({
    rawReply: fence({
      apply: true,
      meals: [
        {
          name: "Пиво светлое (500 мл)",
          kcal: 72,
          protein: 2,
          fat: 0,
          carbs: 16,
          grams: 500,
          unit: "мл",
        },
      ],
    }),
    userMessage: "выпил пиво 0,5",
    today: "2026-11-04",
    date: "2026-11-04",
    allowRepairLlm: false,
  });
  const beer = out.actions?.meals?.[0];
  assert.equal(beer?.kcal, 210);
  assert.equal(beer?.carbs, 16);
  assert.equal(beer?.nutritionWarning, undefined);
});

test("пустой строгий разбор и санитарная проверка пишутся в stdout без текста", async () => {
  const prev = process.env.ASSISTANT_MEAL_TELEMETRY;
  delete process.env.ASSISTANT_MEAL_TELEMETRY;
  const lines: string[] = [];
  const original = console.info;
  console.info = (...args: unknown[]) => {
    lines.push(args.map((part) => String(part)).join(" "));
  };
  try {
    await resolveAssistantTurnActions({
      rawReply: "Не разобрал.",
      userMessage: "съел секретный кварцевый мусс zzq 40 г",
      today: "2026-11-04",
      date: "2026-11-04",
      allowRepairLlm: false,
      extractMeals: async () => ({ meals: [] }),
    });
    await resolveAssistantTurnActions({
      rawReply: fence({
        apply: true,
        meals: [{ name: "Гречка (200 г)", kcal: 500, protein: 6, fat: 2, carbs: 30, grams: 200 }],
      }),
      userMessage: "съел гречку 200 г",
      today: "2026-11-04",
      date: "2026-11-04",
      allowRepairLlm: false,
    });
  } finally {
    console.info = original;
    if (prev === undefined) delete process.env.ASSISTANT_MEAL_TELEMETRY;
    else process.env.ASSISTANT_MEAL_TELEMETRY = prev;
  }
  const empty = lines.find((line) => line.includes("strict-extract-empty"));
  const sanity = lines.find((line) => line.includes("nutrition-sanity"));
  assert.ok(empty, lines.join("\n"));
  assert.ok(sanity, lines.join("\n"));
  assert.doesNotMatch(empty!, /кварц|мусс|гречк/i);
  assert.doesNotMatch(sanity!, /гречк/i);
  assert.match(empty!, /"phraseHash":"[0-9a-f]{16}"/);
  assert.match(sanity!, /macro-energy/);
});
