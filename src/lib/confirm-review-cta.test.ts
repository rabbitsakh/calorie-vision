import assert from "node:assert/strict";
import { test } from "node:test";
import {
  canSaveAsIs,
  confirmReviewPrimaryCta,
  confirmSaveButtonLabel,
  formatPendingConfirmHint,
  photoKindShortLabel,
  saveAsIsHint,
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

test("canSaveAsIs requires low confidence with calories", () => {
  assert.equal(
    canSaveAsIs({ anyLowConfidence: true, anyMissingCalories: false, totalCalories: 400 }),
    true,
  );
  assert.equal(
    canSaveAsIs({ anyLowConfidence: true, anyMissingCalories: true, totalCalories: 400 }),
    false,
  );
  assert.equal(
    canSaveAsIs({ anyLowConfidence: false, anyMissingCalories: false, totalCalories: 400 }),
    false,
  );
  assert.equal(
    canSaveAsIs({ anyLowConfidence: true, anyMissingCalories: false, totalCalories: 0 }),
    false,
  );
});

test("confirmSaveButtonLabel uses save-as-is wording", () => {
  assert.equal(
    confirmSaveButtonLabel({ saving: false, enriching: false, multi: false, saveAsIs: true }),
    "Сохранить как есть",
  );
  assert.equal(
    confirmSaveButtonLabel({ saving: false, enriching: true, multi: false, saveAsIs: false }),
    "Да, сохранить",
  );
  assert.match(saveAsIsHint(), /поправить порцию позже/i);
  assert.equal(photoKindShortLabel("label"), "этикетка");
  assert.match(formatPendingConfirmHint({ dishName: "Чай", calories: 1, photoKind: "meal" }), /Чай/);
});
