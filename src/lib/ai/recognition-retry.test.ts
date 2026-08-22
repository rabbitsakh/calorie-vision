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
