import assert from "node:assert/strict";
import { test } from "node:test";
import {
  canSaveAsIs,
  confirmReviewPrimaryCta,
  confirmSaveButtonLabel,
  confirmSkimHintForPhotoKind,
  confirmSkimTrustLine,
  formatPendingConfirmHint,
  formatSavedMealToast,
  photoKindShortLabel,
  saveAsIsHint,
  worstReviewDishIndex,
} from "./confirm-review-cta.ts";

test("photoKindShortLabel covers store kinds", () => {
  assert.equal(photoKindShortLabel("barcode"), "штрихкод");
  assert.equal(photoKindShortLabel("label"), "этикетка");
  assert.equal(photoKindShortLabel("package"), "упаковка");
  assert.equal(photoKindShortLabel("drink"), "напиток");
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

test("confirmReviewPrimaryCta macros gap prefers Уточнить БЖУ", () => {
  const cta = confirmReviewPrimaryCta({
    enriching: false,
    enrichmentTimedOut: false,
    needsReview: true,
    multi: false,
    missingMacros: true,
    missingCalories: false,
  });
  assert.equal(cta?.mode, "lookup-one");
  assert.equal(cta?.label, "Уточнить БЖУ");
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

test("canSaveAsIs allows low confidence or missing macros when kcal exist", () => {
  assert.equal(
    canSaveAsIs({ anyLowConfidence: true, anyMissingCalories: false, totalCalories: 400 }),
    true,
  );
  assert.equal(
    canSaveAsIs({ anyLowConfidence: true, anyMissingCalories: true, totalCalories: 400 }),
    false,
  );
  assert.equal(
    canSaveAsIs({
      anyLowConfidence: false,
      anyMissingCalories: false,
      anyMissingMacros: true,
      totalCalories: 400,
    }),
    true,
  );
  assert.equal(
    canSaveAsIs({
      anyLowConfidence: true,
      anyMissingCalories: false,
      anyMissingMacros: true,
      totalCalories: 400,
    }),
    true,
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

test("confirmSaveButtonLabel marks soft-save as как есть", () => {
  assert.equal(
    confirmSaveButtonLabel({ saving: false, enriching: false, multi: false, saveAsIs: true }),
    "Сохранить как есть",
  );
  assert.equal(
    confirmSaveButtonLabel({ saving: false, enriching: true, multi: false, saveAsIs: false }),
    "Сохранить",
  );
  assert.equal(
    confirmSaveButtonLabel({ saving: false, enriching: false, multi: true, saveAsIs: false }),
    "Сохранить все",
  );
  assert.match(saveAsIsHint(), /поправить порцию позже/i);
  assert.match(saveAsIsHint({ anyMissingMacros: true }), /БЖУ не заполнены/i);
  assert.match(
    saveAsIsHint({
      anyMissingMacros: true,
      lookupMode: "branded",
      brand: "Простоквашино",
    }),
    /По бренду Простоквашино/,
  );
  assert.match(
    saveAsIsHint({ anyMissingMacros: true, lookupMode: "generic" }),
    /Типичные значения/,
  );
  assert.equal(photoKindShortLabel("label"), "этикетка");
  assert.match(formatPendingConfirmHint({ dishName: "Чай", calories: 1, photoKind: "meal" }), /Чай/);
});

test("formatSavedMealToast includes kcal", () => {
  assert.equal(formatSavedMealToast({ savedCount: 1, totalCalories: 420.4 }), "Сохранено · 420 ккал");
  assert.match(formatSavedMealToast({ savedCount: 3, totalCalories: 840 }), /3 блюд · 840 ккал/);
  assert.match(formatSavedMealToast({ rememberedCorrection: true }), /Запомнили/);
  assert.match(
    formatSavedMealToast({ softSave: true, totalCalories: 350 }),
    /как есть · 350 ккал/,
  );
});

test("confirmSkimTrustLine surfaces macros / confidence / missing kcal on skim", () => {
  assert.equal(
    confirmSkimTrustLine({
      enriching: true,
      enrichmentTimedOut: false,
      needsReview: true,
      anyMissingCalories: false,
      anyMissingMacros: true,
      anyLowConfidence: false,
      multi: false,
    }),
    null,
  );
  assert.match(
    confirmSkimTrustLine({
      enriching: false,
      enrichmentTimedOut: false,
      needsReview: true,
      anyMissingCalories: true,
      anyMissingMacros: false,
      anyLowConfidence: false,
      multi: false,
    }) ?? "",
    /Нет калорий/,
  );
  assert.match(
    confirmSkimTrustLine({
      enriching: false,
      enrichmentTimedOut: false,
      needsReview: true,
      anyMissingCalories: false,
      anyMissingMacros: true,
      anyLowConfidence: false,
      multi: false,
    }) ?? "",
    /БЖУ неполные/,
  );
  assert.match(
    confirmSkimTrustLine({
      enriching: false,
      enrichmentTimedOut: false,
      needsReview: true,
      anyMissingCalories: false,
      anyMissingMacros: false,
      anyLowConfidence: true,
      multi: true,
      lowConfidenceCount: 2,
      dishCount: 3,
    }) ?? "",
    /2\/3/,
  );
  assert.match(
    confirmSkimTrustLine({
      enriching: false,
      enrichmentTimedOut: false,
      needsReview: true,
      anyMissingCalories: false,
      anyMissingMacros: false,
      anyLowConfidence: true,
      multi: false,
      lowestConfidencePercent: "48%",
    }) ?? "",
    /48%/,
  );
});

test("confirmSkimTrustLine prefers drink/label portion hints from eval weak kinds", () => {
  assert.match(confirmSkimHintForPhotoKind("drink") ?? "", /напиток|объём/i);
  assert.match(
    confirmSkimTrustLine({
      enriching: false,
      enrichmentTimedOut: false,
      needsReview: true,
      anyMissingCalories: false,
      anyMissingMacros: true,
      anyLowConfidence: false,
      multi: false,
      photoKind: "drink",
    }) ?? "",
    /напиток|объём/i,
  );
  assert.match(
    confirmSkimTrustLine({
      enriching: false,
      enrichmentTimedOut: false,
      needsReview: true,
      anyMissingCalories: false,
      anyMissingMacros: false,
      anyLowConfidence: true,
      multi: false,
      photoKind: "label",
    }) ?? "",
    /Этикетка|порци/i,
  );
});
