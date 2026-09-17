import assert from "node:assert/strict";
import { test } from "node:test";
import {
  confirmReviewPrimaryCta,
  formatPendingConfirmHint,
  photoKindShortLabel,
  worstReviewDishIndex,
} from "./confirm-review-cta.ts";

test("photoKindShortLabel covers store kinds", () => {
  assert.equal(photoKindShortLabel("barcode"), "штрихкод");
  assert.equal(photoKindShortLabel("label"), "этикетка");
  assert.equal(photoKindShortLabel("package"), "упаковка");
  assert.equal(photoKindShortLabel("meal"), "фото");
  assert.equal(photoKindShortLabel(undefined), null);
});

test("confirmReviewPrimaryCta prefers Досчитать on timeout", () => {
  const cta = confirmReviewPrimaryCta({
    enriching: false,
    enrichmentTimedOut: true,
    needsReview: true,
    multi: true,
  });
  assert.equal(cta?.mode, "force-all");
  assert.equal(cta?.label, "Досчитать");
});

test("confirmReviewPrimaryCta is null while enriching", () => {
  assert.equal(
    confirmReviewPrimaryCta({
      enriching: true,
      enrichmentTimedOut: false,
      needsReview: true,
      multi: false,
    }),
    null,
  );
});

test("confirmReviewPrimaryCta multi uses short Уточнить", () => {
  const cta = confirmReviewPrimaryCta({
    enriching: false,
    enrichmentTimedOut: false,
    needsReview: true,
    multi: true,
  });
  assert.equal(cta?.mode, "lookup-one");
  assert.equal(cta?.label, "Уточнить");
});

test("confirmReviewPrimaryCta single uses Уточнить по названию", () => {
  const cta = confirmReviewPrimaryCta({
    enriching: false,
    enrichmentTimedOut: false,
    needsReview: true,
    multi: false,
  });
  assert.equal(cta?.label, "Уточнить по названию");
});

test("formatPendingConfirmHint includes kcal and kind", () => {
  assert.match(
    formatPendingConfirmHint({
      dishName: "Борщ",
      calories: 420.4,
      photoKind: "label",
    }),
    /«Борщ» · ~420 ккал · этикетка/,
  );
});

test("worstReviewDishIndex picks lowest confidence among review-needed", () => {
  const idx = worstReviewDishIndex([
    { confidence: 0.9, calories: 100, missingCalories: false, lowConfidence: false },
    { confidence: 0.4, calories: 200, missingCalories: false, lowConfidence: true },
    { confidence: 0.5, calories: 0, missingCalories: true, lowConfidence: true },
  ]);
  assert.equal(idx, 1);
});
