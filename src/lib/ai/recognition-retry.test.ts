import assert from "node:assert/strict";
import { test } from "node:test";
import {
  getRecognitionRetryReason,
  isBetterRecognitionResult,
  shouldRetryFoodRecognition,
} from "./recognition-retry.ts";

test("retries when dish name looks like a plate list without items", () => {
  assert.equal(
    shouldRetryFoodRecognition({
      dishName: "Стейк, картофель, салат",
      calories: 600,
      confidence: 0.7,
      photoKind: "meal",
    }),
    true,
  );
  assert.equal(
    getRecognitionRetryReason({
      dishName: "Стейк, картофель, салат",
      calories: 600,
      confidence: 0.7,
      photoKind: "meal",
    }),
    "plate-list-without-items",
  );
});

test("does not retry a clean single-dish meal", () => {
  assert.equal(
    shouldRetryFoodRecognition({
      dishName: "Борщ",
      calories: 280,
      confidence: 0.85,
      photoKind: "meal",
    }),
    false,
  );
});

test("retries failed recognition names", () => {
  assert.equal(
    shouldRetryFoodRecognition({
      dishName: "Не удалось распознать еду",
      calories: 0,
      confidence: 0.1,
      photoKind: "meal",
    }),
    true,
  );
});

test("retries vague meal names", () => {
  assert.equal(
    getRecognitionRetryReason({
      dishName: "Обед",
      calories: 400,
      confidence: 0.6,
      photoKind: "meal",
    }),
    "vague-name",
  );
});

test("retries empty nutrition labels", () => {
  assert.equal(
    getRecognitionRetryReason({
      dishName: "Творог",
      calories: 0,
      confidence: 0.7,
      photoKind: "label",
    }),
    "empty-label",
  );
});

test("prefers retry that splits plate items", () => {
  assert.equal(
    isBetterRecognitionResult(
      {
        dishName: "Стейк, картофель",
        calories: 500,
        confidence: 0.6,
        photoKind: "meal",
      },
      {
        dishName: "Стейк, картофель",
        calories: 520,
        confidence: 0.75,
        photoKind: "meal",
        items: [
          { dishName: "Стейк", calories: 300, confidence: 0.8 },
          { dishName: "Картофель", calories: 220, confidence: 0.7 },
        ],
      },
    ),
    true,
  );
});

test("retries low-confidence meals", () => {
  assert.equal(
    getRecognitionRetryReason({
      dishName: "Котлета с гарниром",
      calories: 420,
      confidence: 0.42,
      photoKind: "meal",
    }),
    "low-confidence",
  );
});

test("retries meals missing macros", () => {
  assert.equal(
    getRecognitionRetryReason({
      dishName: "Гречка с курицей",
      calories: 380,
      confidence: 0.72,
      photoKind: "meal",
    }),
    "missing-macros",
  );
});

test("retries package without barcode or nutrition", () => {
  assert.equal(
    getRecognitionRetryReason({
      dishName: "Печенье",
      calories: 0,
      confidence: 0.62,
      photoKind: "package",
    }),
    "package-no-barcode",
  );
});

test("prefers candidate with filled macros", () => {
  assert.equal(
    isBetterRecognitionResult(
      {
        dishName: "Гречка с курицей",
        calories: 380,
        confidence: 0.72,
        photoKind: "meal",
      },
      {
        dishName: "Гречка с курицей",
        calories: 390,
        protein: 28,
        fat: 8,
        carbs: 42,
        confidence: 0.78,
        photoKind: "meal",
      },
    ),
    true,
  );
});

test("retries packaged soup mismatch on instant cup", () => {
  assert.equal(
    getRecognitionRetryReason({
      dishName: "суп Том Ям",
      calories: 148,
      confidence: 0.8,
      photoKind: "package",
      portionGrams: 40,
    }),
    "packaged-soup-mismatch",
  );
});

test("prefers non-soup name over packaged soup mismatch", () => {
  assert.equal(
    isBetterRecognitionResult(
      {
        dishName: "суп Том Ям",
        calories: 148,
        confidence: 0.8,
        photoKind: "package",
        portionGrams: 40,
      },
      {
        dishName: "Овсянка по-новому",
        calories: 148,
        confidence: 0.75,
        photoKind: "package",
        portionGrams: 40,
      },
    ),
    true,
  );
});
