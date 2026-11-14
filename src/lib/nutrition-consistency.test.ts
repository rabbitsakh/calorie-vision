import assert from "node:assert/strict";
import { test } from "node:test";
import { parseFoodRecognitionResponse } from "./ai/parse-response.ts";
import {
  FOOD_RECOGNITION_PROMPT,
  FOOD_RECOGNITION_RETRY_PROMPT,
  FOOD_VISION_ACCURACY_RULES,
} from "./ai/prompt.ts";
import { buildPlateVisionPrompt, buildDrinkVisionPrompt } from "./ai/category-prompts.ts";
import { buildVisionPrompt } from "./ai/prompt-variants.ts";
import { buildRecognitionRetryPrompt } from "./ai/recognition-retry-prompt.ts";
import { NUTRITION_CONSISTENCY_FIXTURES } from "./nutrition-consistency-fixtures.ts";
import {
  applyNutritionConsistency,
  explainNutritionConsistency,
  LOW_CONFIDENCE_CAP,
  reviewTextMealNutrition,
} from "./nutrition-consistency.ts";
import { normalizeRecognitionNutrition } from "./recognition-nutrition.ts";

for (const fixture of NUTRITION_CONSISTENCY_FIXTURES) {
  test(`consistency/${fixture.id}: ${fixture.description}`, () => {
    const parsed = parseFoodRecognitionResponse(fixture.rawModelText);
    const issues = explainNutritionConsistency(parsed);
    for (const code of fixture.expectIssues) {
      assert.ok(issues.includes(code), `${fixture.id}: нет нарушения ${code}, есть ${issues.join(",") || "—"}`);
    }
    for (const code of issues) {
      assert.ok(
        fixture.expectIssues.includes(code),
        `${fixture.id}: лишнее нарушение ${code}`,
      );
    }

    const fixed = normalizeRecognitionNutrition(parsed);
    if (fixture.expectCalories !== undefined) {
      assert.equal(fixed.calories, fixture.expectCalories);
    }
    if (fixture.expectPortionGrams !== undefined) {
      assert.equal(fixed.portionGrams, fixture.expectPortionGrams);
    }
    if (fixture.expectProtein !== undefined) {
      assert.equal(fixed.protein, fixture.expectProtein);
    }
    if (fixture.expectConfidenceAtMost !== undefined) {
      assert.ok(
        fixed.confidence <= fixture.expectConfidenceAtMost,
        `confidence ${fixed.confidence} > ${fixture.expectConfidenceAtMost}`,
      );
      assert.ok(fixed.confidence <= LOW_CONFIDENCE_CAP);
    } else if (fixture.expectIssues.length === 0) {
      assert.ok(fixed.confidence >= parsed.confidence - 0.001);
    }
  });
}

test("эталон без клетчатки ловит ту же буханку как расхождение БЖУ", () => {
  const parsed = parseFoodRecognitionResponse(
    JSON.stringify({
      photoKind: "meal",
      dishName: "Хлеб ржаной",
      calories: 140,
      protein: 2,
      fat: 1,
      carbs: 40,
      portionGrams: 100,
      confidence: 0.8,
    }),
  );
  assert.ok(explainNutritionConsistency(parsed).includes("macro-energy"));
  const fixed = normalizeRecognitionNutrition(parsed);
  assert.equal(fixed.calories, 140);
  assert.ok(fixed.confidence <= LOW_CONFIDENCE_CAP);
});

test("безалкогольное пиво не получает калории этанола", () => {
  const parsed = parseFoodRecognitionResponse(
    JSON.stringify({
      photoKind: "meal",
      dishName: "Пиво безалкогольное",
      calories: 72,
      protein: 2,
      fat: 0,
      carbs: 16,
      portionGrams: 500,
      confidence: 0.8,
    }),
  );
  assert.deepEqual(explainNutritionConsistency(parsed), []);
  const normalized = normalizeRecognitionNutrition(parsed);
  assert.equal(normalized.calories, 360);
  assert.ok(normalized.calories < 400);
});

test("этанол добавляется к БЖУ, пока плотность пива ещё слишком низкая", () => {
  const fixed = applyNutritionConsistency({
    dishName: "Пиво светлое",
    calories: 72,
    protein: 2,
    fat: 0,
    carbs: 16,
    portionGrams: 500,
    confidence: 0.74,
  });
  assert.equal(fixed.calories, 210);
  assert.equal(fixed.carbs, 16);
});

test("выпечка плотнее 550 ккал/100 г снижает уверенность и не переписывает ккал", () => {
  const cake = {
    dishName: "Торт Наполеон",
    calories: 600,
    protein: 6,
    fat: 28,
    carbs: 70,
    portionGrams: 100,
    confidence: 0.8,
  };
  assert.ok(explainNutritionConsistency(cake).includes("density"));
  const fixed = applyNutritionConsistency(cake);
  assert.equal(fixed.calories, 600);
  assert.equal(fixed.protein, 6);
  assert.ok(fixed.confidence <= LOW_CONFIDENCE_CAP);
});

test("этикетка с массой БЖУ больше порции помечается и не переписывается", () => {
  const label = {
    dishName: "Сыр твёрдый",
    calories: 350,
    protein: 24,
    fat: 28,
    carbs: 0,
    portionGrams: 50,
    confidence: 0.9,
    source: "label",
  };
  assert.ok(explainNutritionConsistency(label).includes("macro-mass"));
  const fixed = applyNutritionConsistency(label);
  assert.equal(fixed.calories, 350);
  assert.equal(fixed.protein, 24);
  assert.equal(fixed.fat, 28);
  assert.ok(fixed.confidence <= LOW_CONFIDENCE_CAP);
});

test("текст: 100 г БЖУ на стакан молока пересчитываются, расхождение только предупреждается", () => {
  const milk = reviewTextMealNutrition({
    name: "Молоко (250 мл)",
    kcal: 130,
    protein: 2.8,
    fat: 2.5,
    carbs: 4.7,
    grams: 250,
  });
  assert.ok(milk.codes.includes("per100-basis"));
  assert.equal(milk.protein, 7);
  assert.equal(milk.fat, 6.3);
  assert.equal(milk.carbs, 11.8);
  assert.equal(milk.kcal, 130);
  assert.equal(milk.warning, null);

  const gap = reviewTextMealNutrition({
    name: "Гречка (200 г)",
    kcal: 500,
    protein: 6,
    fat: 2,
    carbs: 30,
    grams: 200,
  });
  assert.deepEqual(gap.codes, ["macro-energy"]);
  assert.equal(gap.kcal, 500);
  assert.equal(gap.protein, 6);
  assert.match(gap.warning ?? "", /не сходятся/);

  const heavy = reviewTextMealNutrition({
    name: "Сыр (50 г)",
    kcal: 348,
    protein: 24,
    fat: 28,
    carbs: 0,
    grams: 50,
  });
  assert.ok(heavy.codes.includes("macro-mass"));
  assert.equal(heavy.protein, 24);
  assert.equal(heavy.fat, 28);
  assert.match(heavy.warning ?? "", /больше порции/);

  const dense = reviewTextMealNutrition({
    name: "Курица (100 г)",
    kcal: 800,
    protein: 30,
    fat: 10,
    carbs: 0,
    grams: 100,
  });
  assert.ok(dense.codes.includes("density"));
  assert.equal(dense.kcal, 800);

  const beer = reviewTextMealNutrition({
    name: "Пиво светлое (500 мл)",
    kcal: 72,
    protein: 2,
    fat: 0,
    carbs: 16,
    grams: 500,
  });
  assert.ok(beer.codes.includes("alcohol-gap"));
  assert.equal(beer.kcal, 210);
  assert.equal(beer.carbs, 16);
});

test("промпт просит ориентиры веса, скрытый жир и строгий JSON", () => {
  assert.match(FOOD_RECOGNITION_PROMPT, /тарелка ≈25 см/);
  assert.match(FOOD_RECOGNITION_PROMPT, /вилка ≈19 см/);
  assert.match(FOOD_RECOGNITION_PROMPT, /стакан 200–250 мл/);
  assert.match(FOOD_RECOGNITION_PROMPT, /Скрытые масло и соусы/);
  assert.match(FOOD_RECOGNITION_PROMPT, /4·protein \+ 4·carbs \+ 9·fat/);
  assert.match(FOOD_RECOGNITION_PROMPT, /Строгий JSON/);
  assert.match(FOOD_RECOGNITION_PROMPT, /без markdown/);
  assert.ok(FOOD_RECOGNITION_PROMPT.includes(FOOD_VISION_ACCURACY_RULES));
  assert.match(buildVisionPrompt("slim"), /Скрытые масло и соусы/);
  assert.doesNotMatch(buildVisionPrompt("slim"), /"fiber"/);
  assert.match(buildPlateVisionPrompt(), /Скрытые масло и соусы/);
  assert.match(buildDrinkVisionPrompt(), /этанола/);
  assert.match(FOOD_RECOGNITION_RETRY_PROMPT, /Масло, соус/);
  assert.match(buildRecognitionRetryPrompt("missing-macros"), /Сумма items/);
  assert.ok(FOOD_RECOGNITION_PROMPT.length < 3500, String(FOOD_RECOGNITION_PROMPT.length));
  assert.ok(FOOD_RECOGNITION_RETRY_PROMPT.length < 900, String(FOOD_RECOGNITION_RETRY_PROMPT.length));
  assert.ok(buildRecognitionRetryPrompt("missing-macros").length < 1200);
});
