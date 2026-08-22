import assert from "node:assert/strict";
import { test } from "node:test";
import { buildRecognitionRetryPrompt } from "./recognition-retry-prompt.ts";
import { buildVisionPrompt, visionPromptCharLength, type PromptVariant } from "./prompt-variants.ts";
import { pickSpecialistPass } from "./specialist-pass.ts";
import { shouldForcePlateBeforeRetry } from "./plate-vision.ts";
import { RECOGNITION_EVAL_CASES } from "./recognition-eval-fixtures.ts";
import { runRecognitionEvalSuite } from "./recognition-eval-harness.ts";
import { parseFoodRecognitionResponse } from "./parse-response.ts";
import { hasCompleteVisionNutrition, normalizeRecognitionNutrition } from "../recognition-nutrition.ts";
import { enrichAlternativesFromRuTable } from "../recognition-alternatives.ts";
import { combineRecognitionItems } from "../recognition-items.ts";

test("eval harness passes all fixtures", () => {
  const summary = runRecognitionEvalSuite(RECOGNITION_EVAL_CASES);
  if (summary.failed > 0) {
    const details = summary.results
      .filter((result) => !result.passed)
      .map((result) => `${result.id}: ${result.errors.join("; ")}`)
      .join("\n");
    assert.fail(`eval failures (${summary.failed}):\n${details}`);
  }
  assert.ok(summary.passed >= 50);
});

test("shouldForcePlateBeforeRetry targets comma-list meals without items", () => {
  assert.equal(
    shouldForcePlateBeforeRetry({
      dishName: "Суп, хлеб, салат",
      calories: 400,
      confidence: 0.7,
      photoKind: "meal",
    }),
    true,
  );
});

test("pickSpecialistPass prefers barcode before plate on package photo", () => {
  const pass = pickSpecialistPass({
    dishName: "Молоко",
    calories: 0,
    confidence: 0.7,
    photoKind: "barcode",
  });
  assert.equal(pass, "barcode");
});

test("pickSpecialistPass routes drink before package for bottles", () => {
  const pass = pickSpecialistPass({
    dishName: "Coca-Cola Zero",
    brand: "Coca-Cola",
    calories: 1,
    confidence: 0.7,
    photoKind: "package",
    portionGrams: 100,
  });
  assert.equal(pass, "drink");
});

test("enrichAlternativesFromRuTable fills calories-only vision alternatives", () => {
  const enriched = enrichAlternativesFromRuTable(
    parseFoodRecognitionResponse(
      RECOGNITION_EVAL_CASES.find((c) => c.id === "alt-calories-only-borscht")!.rawModelJson,
    ),
  );
  const alt = enriched.alternatives?.[0];
  assert.equal(alt?.protein, 12);
  assert.equal(alt?.carbs, 22);
});

test("pipeline/combine + complete vision on enriched plate item", () => {
  const item = parseFoodRecognitionResponse(
    RECOGNITION_EVAL_CASES.find((c) => c.id === "plate-multi")!.rawModelJson,
  ).items![0]!;
  assert.equal(
    hasCompleteVisionNutrition({
      ...item,
      photoKind: "meal",
    }),
    false,
  );

  const combined = combineRecognitionItems(
    [
      { dishName: "Стейк", calories: 400, protein: 40, fat: 20, carbs: 0, portionGrams: 150, confidence: 0.8 },
      { dishName: "Картофель", calories: 180, protein: 4, fat: 6, carbs: 28, portionGrams: 200, confidence: 0.75 },
    ],
    { dishName: "Обед", calories: 999, confidence: 0.5, photoKind: "meal" },
  );
  assert.equal(combined.calories, 580);
});

test("normalizeRecognitionNutrition scales drink label with bottle volume in name", () => {
  const fixture = RECOGNITION_EVAL_CASES.find((c) => c.id === "drink-label-portion-1500");
  assert.ok(fixture);
  const parsed = parseFoodRecognitionResponse(fixture!.rawModelJson);
  const normalized = normalizeRecognitionNutrition(parsed);
  assert.ok(normalized.calories >= 500);
});

test("retry prompts cover all known reasons", () => {
  const reasons = [
    "plate-list-without-items",
    "missing-macros",
    "package-no-barcode",
    "empty-label",
    "low-confidence",
    "vague-name",
    "zero-calorie-meal",
    "failed-name",
  ] as const;

  for (const reason of reasons) {
    const prompt = buildRecognitionRetryPrompt(reason);
    assert.ok(prompt.length > 100);
    assert.match(prompt, /JSON/i);
  }
});

test("prompt variants are ordered by size for offline A/B", () => {
  const variants: PromptVariant[] = ["main", "slim", "category-first"];
  const lengths = Object.fromEntries(variants.map((variant) => [variant, visionPromptCharLength(variant)]));

  assert.ok(lengths.slim < lengths.main);
  assert.ok(lengths["category-first"] > 0);
  assert.ok(lengths.main > 500);
});

test("all prompt variants mention JSON output shape", () => {
  for (const variant of ["main", "slim", "category-first"] as const) {
    const prompt = buildVisionPrompt(variant);
    assert.match(prompt, /JSON/i);
    assert.match(prompt, /photoKind/i);
    assert.match(prompt, /dishName/i);
  }
});
