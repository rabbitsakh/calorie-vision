import assert from "node:assert/strict";
import { test } from "node:test";
import {
  buildEveningDaySummary,
  buildEveningPhrases,
  pickEveningSuggestions,
  shouldShowEveningDaySummary,
  type EveningFoodInput,
  type EveningTargets,
  type EveningTotals,
} from "./evening-day-summary.ts";

const targets: EveningTargets = {
  calories: 1800,
  protein: 110,
  fat: 60,
  carbs: 200,
  waterMl: 2000,
};

const eveningExample: EveningTotals = {
  calories: 1720,
  protein: 80,
  fat: 55,
  carbs: 180,
  waterMl: 1300,
};

const history: EveningFoodInput[] = [
  {
    name: "Творог 5%",
    calories: 180,
    protein: 34,
    fat: 5,
    carbs: 4,
    portionGrams: 200,
    useCount: 6,
  },
  {
    name: "Кефир 1%",
    calories: 80,
    protein: 6,
    fat: 2,
    carbs: 8,
    portionGrams: 200,
    useCount: 4,
  },
  {
    name: "Пирожное",
    calories: 250,
    protein: 3,
    fat: 12,
    carbs: 32,
    portionGrams: 80,
    useCount: 9,
  },
];

const SHAME = /перебор|стыд|слишком много|виноват|плохо|обжор/i;

test("карточка только сегодня, с 18:00 и если есть записи", () => {
  assert.equal(
    shouldShowEveningDaySummary({ isToday: true, hour: 17, entryCount: 2 }),
    false,
  );
  assert.equal(
    shouldShowEveningDaySummary({ isToday: true, hour: 18, entryCount: 2 }),
    true,
  );
  assert.equal(
    shouldShowEveningDaySummary({ isToday: true, hour: 23, entryCount: 1 }),
    true,
  );
  assert.equal(
    shouldShowEveningDaySummary({ isToday: true, hour: 20, entryCount: 0 }),
    false,
  );
  assert.equal(
    shouldShowEveningDaySummary({ isToday: false, hour: 21, entryCount: 3 }),
    false,
  );
});

test("фразы: белок и вода, без упрёка", () => {
  const phrases = buildEveningPhrases(eveningExample, targets);
  assert.deepEqual(phrases, [
    "Калории в норме, воды ещё 0,7 л",
    "До нормы белка не хватает 30 г",
  ]);
  assert.equal(SHAME.test(phrases.join(" ")), false);
});

test("подсказки сначала из истории и не выходят за остаток калорий", () => {
  const suggestions = pickEveningSuggestions({
    totals: eveningExample,
    targets,
    history,
  });
  assert.ok(suggestions.length >= 2 && suggestions.length <= 3);
  assert.equal(suggestions[0]?.source, "history");
  assert.equal(suggestions[0]?.name, "Творог 5%");
  assert.ok(suggestions[0]!.calories <= 80);
  assert.equal(suggestions.some((item) => item.name === "Пирожное"), false);
  assert.equal(suggestions.some((item) => item.source === "catalog"), true);
  assert.equal(
    suggestions.some((item) => item.name === "Творог 0%"),
    true,
  );
  for (const item of suggestions) {
    assert.ok(item.calories <= 80, `${item.label} = ${item.calories}`);
    assert.ok(item.protein >= 3);
  }
});

test("без подходящей истории берём справочник", () => {
  const suggestions = pickEveningSuggestions({
    totals: { calories: 1400, protein: 70, fat: 50, carbs: 160, waterMl: 1500 },
    targets,
    history: [
      {
        name: "Пирожное",
        calories: 250,
        protein: 3,
        fat: 12,
        carbs: 32,
        portionGrams: 80,
        useCount: 4,
      },
    ],
  });
  assert.ok(suggestions.length >= 2 && suggestions.length <= 3);
  assert.equal(suggestions[0]?.source, "catalog");
  assert.equal(suggestions[0]?.name, "Творог 0%");
  assert.equal(suggestions.some((item) => item.name === "Кефир 1%" || item.name === "Яйцо варёное" || item.name === "Куриная грудка"), true);
  for (const item of suggestions) {
    assert.ok(item.calories <= 400);
  }
});

test("привычная порция уменьшается, чтобы не перебрать калории", () => {
  const suggestions = pickEveningSuggestions({
    totals: { calories: 1620, protein: 70, fat: 40, carbs: 150, waterMl: 1000 },
    targets,
    history: [
      {
        name: "Куриная грудка",
        calories: 360,
        protein: 72,
        fat: 6,
        carbs: 0,
        portionGrams: 200,
        useCount: 3,
      },
    ],
  });
  const chicken = suggestions.find((item) => item.name === "Куриная грудка");
  assert.ok(chicken);
  assert.equal(chicken.source, "history");
  assert.ok(chicken.calories <= 180);
  assert.ok((chicken.portionGrams ?? 0) < 200);
  assert.ok(chicken.protein >= 5);
});

test("при закрытых калориях еду не предлагаем и не стыдим", () => {
  const summary = buildEveningDaySummary({
    totals: { calories: 2100, protein: 70, fat: 80, carbs: 220, waterMl: 1200 },
    targets,
    history,
  });
  assert.equal(summary.suggestions.length, 0);
  assert.equal(summary.phrases[0], "Калории уже закрыты");
  assert.match(summary.phrases[1] ?? "", /Воды ещё/);
  assert.equal(SHAME.test(summary.phrases.join(" ")), false);
  assert.equal(summary.phrases.some((line) => /сверх|лишн/i.test(line)), false);
});

test("ровный день — одна спокойная фраза", () => {
  const phrases = buildEveningPhrases(
    { calories: 1800, protein: 110, fat: 60, carbs: 200, waterMl: 2000 },
    targets,
  );
  assert.deepEqual(phrases, ["День собран: калории, БЖУ и вода в норме"]);
  assert.equal(
    pickEveningSuggestions({
      totals: { calories: 1800, protein: 110, fat: 60, carbs: 200, waterMl: 2000 },
      targets,
      history,
    }).length,
    0,
  );
});

test("подбор детерминированный", () => {
  const input = { totals: eveningExample, targets, history };
  assert.deepEqual(buildEveningDaySummary(input), buildEveningDaySummary(input));
});

test("в статистике есть ккал, БЖУ и вода", () => {
  const summary = buildEveningDaySummary({ totals: eveningExample, targets, history });
  const keys = summary.stats.map((stat) => stat.key);
  assert.deepEqual(keys, ["calories", "protein", "fat", "carbs", "water"]);
  assert.match(summary.stats[1]!.text, /80 из 110/);
  assert.match(summary.stats[4]!.text, /л/);
});
