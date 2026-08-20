import assert from "node:assert/strict";
import { test } from "node:test";
import { shouldRetryFoodRecognition } from "./recognition-retry.ts";

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
