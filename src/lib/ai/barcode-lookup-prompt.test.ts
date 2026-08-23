import assert from "node:assert/strict";
import { test } from "node:test";
import { buildBarcodeLookupPrompt } from "./prompt.ts";
import { finalizeGigaChatBarcodeResult } from "../food-recognition.ts";
import { shouldSkipSlowPostVisionEnrichment } from "../recognition-nutrition.ts";
import { RECOGNITION_SOURCE_LABELS } from "../food-types.ts";

test("barcode lookup prompt embeds the EAN and asks for pack macros", () => {
  const prompt = buildBarcodeLookupPrompt("4600605023124");
  assert.match(prompt, /4600605023124/);
  assert.match(prompt, /photoKind": "barcode"/);
  assert.match(prompt, /portionGrams/);
  assert.match(prompt, /per100g/);
  assert.match(prompt, /confidence/);
});

test("finalizeGigaChatBarcodeResult caps confidence and sets source", () => {
  const result = finalizeGigaChatBarcodeResult(
    {
      dishName: "Молоко 3.2%",
      calories: 120,
      protein: 6,
      fat: 6.4,
      carbs: 9.4,
      fiber: 0,
      sugar: 9.4,
      portionGrams: 200,
      confidence: 0.95,
      photoKind: "meal",
      source: "gigachat",
    },
    "4600605023124",
  );

  assert.equal(result.source, "gigachat-barcode");
  assert.equal(result.photoKind, "barcode");
  assert.equal(result.barcode, "4600605023124");
  assert.equal(result.confidence, 0.7);
  assert.equal(RECOGNITION_SOURCE_LABELS["gigachat-barcode"], "Оценка по штрихкоду (ИИ)");
});

test("finalizeGigaChatBarcodeResult floors very low confidence", () => {
  const result = finalizeGigaChatBarcodeResult(
    {
      dishName: "Сок",
      calories: 90,
      portionGrams: 200,
      confidence: 0.1,
    },
    "4601234567890",
  );
  assert.equal(result.confidence, 0.45);
});

test("gigachat-barcode source skips slow post-vision enrichment when calories exist", () => {
  assert.equal(
    shouldSkipSlowPostVisionEnrichment({
      photoKind: "barcode",
      source: "gigachat-barcode",
      calories: 180,
    }),
    true,
  );
});
