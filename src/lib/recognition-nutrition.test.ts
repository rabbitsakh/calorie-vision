import assert from "node:assert/strict";
import { test } from "node:test";
import {
  clearSuspiciousZeroFiberSugar,
  inferPer100gValues,
  hasCompleteVisionNutrition,
  hasSufficientVisionNutrition,
  mergeFiberSugarBackfill,
  mergeNutritionBackfill,
  normalizePer100gEnergy,
  normalizeRecognitionNutrition,
  needsFiberSugarBackfill,
  needsNutritionLookup,
  nutritionBaselineFromRecognition,
  recognitionNeedsPortionRescale,
  resolvePer100gForScaling,
  scaleRecognitionToPortion,
  shouldSkipSlowPostVisionEnrichment,
  simplifyDishNameForLookup,
} from "./recognition-nutrition.ts";
import { scaleNutritionByPortion } from "./nutrition.ts";

test("normalizes zero calories from per100g data", () => {
  const normalized = normalizeRecognitionNutrition({
    dishName: "Творог 5%",
    calories: 0,
    confidence: 0.8,
    photoKind: "label",
    per100g: { calories: 121, protein: 16, fat: 5, carbs: 3 },
  });

  assert.equal(normalized.calories, 121);
  assert.equal(normalized.portionGrams, 100);
  assert.equal(normalized.protein, 16);
});

test("scales per-100 ml beer values to a 500 ml bottle", () => {
  const normalized = normalizeRecognitionNutrition({
    dishName: "Пиво Konix Пресли светлое нефильтрованное",
    calories: 45,
    protein: 0.6,
    fat: 0,
    carbs: 4.7,
    portionGrams: 500,
    confidence: 0.85,
    photoKind: "meal",
    source: "gigachat-lookup",
  });

  assert.equal(normalized.calories, 225);
  assert.equal(normalized.portionGrams, 500);
  assert.equal(normalized.carbs, 23.5);
  assert.equal(normalized.protein, 3);
});

test("keeps totals that already match the portion weight", () => {
  const normalized = normalizeRecognitionNutrition({
    dishName: "Паста с морепродуктами",
    calories: 520,
    protein: 24,
    fat: 12,
    carbs: 60,
    confidence: 0.7,
    photoKind: "meal",
    portionGrams: 250,
  });

  assert.equal(normalized.calories, 520);
  assert.equal(normalized.portionGrams, 250);
});

test("defaults meal portion grams for portion scaling", () => {
  const normalized = normalizeRecognitionNutrition({
    dishName: "Паста с морепродуктами",
    calories: 520,
    protein: 24,
    fat: 12,
    carbs: 60,
    confidence: 0.7,
    photoKind: "meal",
  });

  assert.equal(normalized.portionGrams, 250);
});

test("infers per-100g source for low-density drinks", () => {
  const inferred = inferPer100gValues(
    { protein: 0.6, fat: 0, carbs: 4.7 },
    45,
    500,
  );

  assert.equal(inferred?.calories, 45);
  assert.equal(inferred?.carbs, 4.7);
});

test("detects when nutrition lookup is still needed", () => {
  assert.equal(
    needsNutritionLookup({
      dishName: "Паста с морепродуктами",
      calories: 0,
      protein: 0,
      fat: 0,
      carbs: 0,
      confidence: 0.7,
      photoKind: "meal",
    }),
    true,
  );
  assert.equal(
    needsNutritionLookup({
      dishName: "Паста с морепродуктами",
      calories: 520,
      protein: 24,
      fat: 12,
      carbs: 60,
      confidence: 0.7,
      photoKind: "meal",
      portionGrams: 250,
    }),
    false,
  );
});

test("simplifies dish names for a second nutrition lookup", () => {
  assert.equal(
    simplifyDishNameForLookup("Паста карбонара (домашняя, большая порция)"),
    "Паста карбонара",
  );
  assert.equal(simplifyDishNameForLookup("Борщ"), null);
});

test("merges lookup nutrition onto a zero-calorie vision item and scales portion", () => {
  const merged = mergeNutritionBackfill(
    {
      dishName: "Картофель фри",
      calories: 0,
      protein: 0,
      fat: 0,
      carbs: 0,
      portionGrams: 150,
      confidence: 0.8,
      photoKind: "meal",
      source: "gigachat",
    },
    {
      dishName: "Картофель фри",
      calories: 312,
      protein: 4,
      fat: 15,
      carbs: 41,
      portionGrams: 100,
      confidence: 0.75,
      source: "openfoodfacts-search",
      photoKind: "package",
    },
  );

  assert.equal(merged.dishName, "Картофель фри");
  assert.equal(merged.portionGrams, 150);
  assert.equal(merged.calories, 468);
  assert.equal(merged.protein, 6);
  assert.equal(merged.source, "openfoodfacts-search");
  assert.equal(merged.photoKind, "meal");
});

test("keeps vision macros when only calories were missing", () => {
  const merged = mergeNutritionBackfill(
    {
      dishName: "Салат",
      calories: 0,
      protein: 3,
      fat: 8,
      carbs: 4,
      portionGrams: 120,
      confidence: 0.6,
      photoKind: "meal",
    },
    {
      dishName: "Салат Цезарь",
      calories: 180,
      protein: 10,
      fat: 12,
      carbs: 8,
      portionGrams: 120,
      confidence: 0.7,
      source: "gigachat-lookup",
    },
  );

  assert.equal(merged.calories, 180);
  assert.equal(merged.protein, 3);
  assert.equal(merged.fat, 8);
  assert.equal(merged.carbs, 4);
});

test("keeps enriched sugar when per100g omits sugars", () => {
  // Package vision often returns per100g with fiber but no sugar; enrich fills sugar on the
  // portion, then a second normalize must not wipe it back to blank.
  const normalized = normalizeRecognitionNutrition({
    dishName: "Протеиновый батончик",
    calories: 100,
    protein: 10,
    fat: 6.4,
    carbs: 3.4,
    fiber: undefined,
    sugar: 1.2,
    portionGrams: 40,
    confidence: 0.9,
    photoKind: "package",
    source: "openfoodfacts-barcode",
    per100g: {
      calories: 250,
      protein: 25,
      fat: 16,
      carbs: 8.5,
      fiber: 38,
    },
  });

  assert.equal(normalized.portionGrams, 40);
  assert.equal(normalized.fiber, 15.2);
  assert.equal(normalized.sugar, 1.2);
  assert.equal(normalized.protein, 10);
});

test("fills missing fiber and sugar from a second lookup with portion scale", () => {
  const merged = mergeFiberSugarBackfill(
    {
      dishName: "Хурма",
      calories: 102,
      protein: 0.8,
      fat: 0.5,
      carbs: 23,
      portionGrams: 150,
      confidence: 0.85,
      source: "gigachat-lookup",
      photoKind: "meal",
    },
    {
      dishName: "Хурма",
      calories: 68,
      fiber: 2.5,
      sugar: 16,
      portionGrams: 100,
      confidence: 0.8,
      source: "openfoodfacts-search",
    },
  );

  assert.equal(merged.calories, 102);
  assert.equal(merged.fiber, 3.8);
  assert.equal(merged.sugar, 24);
  assert.equal(needsFiberSugarBackfill(merged), false);
});

test("keeps explicit zero fiber and does not treat it as missing", () => {
  const merged = mergeFiberSugarBackfill(
    {
      dishName: "Куриная грудка",
      calories: 165,
      fiber: 0,
      sugar: 0,
      portionGrams: 100,
      confidence: 0.9,
      photoKind: "meal",
    },
    {
      dishName: "Куриная грудка",
      calories: 165,
      fiber: 3,
      sugar: 2,
      portionGrams: 100,
      confidence: 0.5,
    },
  );

  assert.equal(merged.fiber, 0);
  assert.equal(merged.sugar, 0);
  assert.equal(needsFiberSugarBackfill({ fiber: undefined, sugar: 1 }), true);
});


test("fiber/sugar backfill is independent of calorie completeness", () => {
  // Photo path often has calories+macros but omits fiber/sugar keys — still needs fill.
  assert.equal(
    needsFiberSugarBackfill({
      fiber: undefined,
      sugar: undefined,
    }),
    true,
  );
  assert.equal(
    needsFiberSugarBackfill({
      fiber: 0,
      sugar: 0,
      carbs: 24,
    }),
    true,
  );
  assert.equal(
    needsFiberSugarBackfill({
      fiber: 0,
      sugar: 0,
      carbs: 0,
    }),
    false,
  );
  assert.equal(
    needsNutritionLookup({
      dishName: "Хурма",
      calories: 102,
      protein: 0.8,
      fat: 0.5,
      carbs: 23,
      confidence: 0.9,
      photoKind: "meal",
    }),
    false,
  );
});

test("clears suspicious zero fiber/sugar on carb-heavy vision results", () => {
  const normalized = normalizeRecognitionNutrition({
    dishName: "Овсянка с ягодами",
    calories: 320,
    protein: 10,
    fat: 6,
    carbs: 52,
    fiber: 0,
    sugar: 0,
    portionGrams: 250,
    confidence: 0.8,
    photoKind: "meal",
  });

  assert.equal(normalized.fiber, undefined);
  assert.equal(normalized.sugar, undefined);
  assert.equal(
    clearSuspiciousZeroFiberSugar({
      dishName: "Куриная грудка",
      calories: 165,
      fiber: 0,
      sugar: 0,
      carbs: 0,
      confidence: 0.9,
      photoKind: "meal",
    }).fiber,
    0,
  );
});

test("hasSufficientVisionNutrition skips backfill when macros are present", () => {
  assert.equal(
    hasSufficientVisionNutrition({
      dishName: "Стейк",
      calories: 400,
      protein: 40,
      fat: 20,
      carbs: 0,
      confidence: 0.8,
    }),
    true,
  );
  assert.equal(
    hasSufficientVisionNutrition({
      dishName: "Стейк",
      calories: 400,
      protein: 40,
      confidence: 0.8,
    }),
    false,
  );
  assert.equal(
    hasSufficientVisionNutrition({
      dishName: "Стейк",
      calories: 0,
      protein: 40,
      fat: 20,
      carbs: 0,
      confidence: 0.8,
    }),
    false,
  );
});

test("nutritionBaselineFromRecognition anchors per-100 ml drinks at 100 ml", () => {
  const baseline = nutritionBaselineFromRecognition({
    calories: 38,
    carbs: 9,
    portionGrams: 700,
  });

  assert.equal(baseline?.calories, 38);
  assert.equal(baseline?.portionGrams, 100);

  const scaled = scaleNutritionByPortion(baseline!, 1500);
  assert.equal(scaled?.calories, 570);
  assert.equal(scaled?.carbs, 135);
});

test("nutritionBaselineFromRecognition uses explicit per100g for portion chips", () => {
  const baseline = nutritionBaselineFromRecognition({
    calories: 266,
    protein: 3,
    fat: 0,
    carbs: 63,
    portionGrams: 700,
    per100g: { calories: 38, protein: 0.4, fat: 0, carbs: 9 },
    photoKind: "label",
    source: "label",
  });

  assert.equal(baseline?.calories, 38);
  assert.equal(baseline?.portionGrams, 100);
  assert.equal(scaleNutritionByPortion(baseline!, 1500)?.calories, 570);
});

test("resolvePer100gForScaling treats label kcal/100ml in calories field", () => {
  const per100 = resolvePer100gForScaling({
    dishName: "Пиво светлое фильтрованное",
    calories: 42,
    carbs: 28,
    portionGrams: 1500,
    photoKind: "label",
    source: "label",
  });

  assert.equal(per100?.calories, 42);

  const baseline = nutritionBaselineFromRecognition({
    dishName: "Пиво светлое фильтрованное",
    calories: 42,
    carbs: 28,
    portionGrams: 1500,
    photoKind: "label",
    source: "label",
  });
  assert.equal(scaleNutritionByPortion(baseline!, 1500)?.calories, 630);
});

test("resolvePer100gForScaling detects drinks before label metadata arrives", () => {
  const per100 = resolvePer100gForScaling({
    dishName: "Пиво светлое",
    calories: 38,
    carbs: 9,
    portionGrams: 1500,
    photoKind: "meal",
    source: "gigachat",
  });

  assert.equal(per100?.calories, 38);
  assert.equal(
    scaleNutritionByPortion(nutritionBaselineFromRecognition({
      dishName: "Пиво светлое",
      calories: 38,
      carbs: 9,
      portionGrams: 1500,
      photoKind: "meal",
      source: "gigachat",
    })!, 1500)?.calories,
    570,
  );
});

test("label with wrong bottle total still scales from per100g", () => {
  const normalized = normalizeRecognitionNutrition({
    dishName: "Пиво Северное сияние",
    calories: 322,
    protein: 3,
    fat: 0,
    carbs: 28,
    portionGrams: 700,
    confidence: 0.9,
    photoKind: "label",
    source: "label",
    per100g: { calories: 38, protein: 0.4, fat: 0, carbs: 4 },
  });

  assert.equal(normalized.calories, 266);
  assert.equal(normalized.per100g?.calories, 38);

  const baseline = nutritionBaselineFromRecognition(normalized);
  assert.equal(scaleNutritionByPortion(baseline!, 1500)?.calories, 570);
});

test("normalizePer100gEnergy converts label kJ to kcal", () => {
  const per100 = normalizePer100gEnergy({ calories: 159, protein: 0.4, carbs: 4 });
  assert.equal(per100?.calories, 38);

  const normalized = normalizeRecognitionNutrition({
    dishName: "Пиво",
    calories: 0,
    portionGrams: 1500,
    confidence: 0.9,
    photoKind: "label",
    source: "label",
    per100g: { calories: 159, protein: 0.4, carbs: 4 },
  });

  assert.equal(normalized.per100g?.calories, 38);
  assert.equal(normalized.calories, 570);
});

test("nutritionBaselineFromRecognition keeps true portion totals for dense meals", () => {
  const baseline = nutritionBaselineFromRecognition({
    calories: 520,
    protein: 24,
    fat: 12,
    carbs: 60,
    portionGrams: 250,
  });

  assert.equal(baseline?.calories, 520);
  assert.equal(baseline?.portionGrams, 250);
  assert.equal(scaleNutritionByPortion(baseline!, 500)?.calories, 1040);
});

test("hasCompleteVisionNutrition skips enrichment when vision is full", () => {
  assert.equal(
    hasCompleteVisionNutrition({
      dishName: "Стейк",
      calories: 400,
      protein: 40,
      fat: 20,
      carbs: 0,
      fiber: 0,
      sugar: 0,
      portionGrams: 200,
      confidence: 0.85,
      photoKind: "meal",
    }),
    true,
  );
  assert.equal(
    hasCompleteVisionNutrition({
      dishName: "Овсянка",
      calories: 320,
      protein: 12,
      fat: 6,
      carbs: 52,
      portionGrams: 250,
      confidence: 0.8,
      photoKind: "meal",
    }),
    false,
  );
});

test("resolvePer100gForScaling detects label drinks before portionGrams arrives", () => {
  const per100 = resolvePer100gForScaling({
    dishName: "Пиво светлое фильтрованное",
    calories: 42,
    carbs: 28,
    photoKind: "label",
    source: "label",
  });

  assert.equal(per100?.calories, 42);
  assert.equal(scaleRecognitionToPortion({
    dishName: "Пиво светлое фильтрованное",
    calories: 42,
    carbs: 28,
    portionGrams: 1500,
    photoKind: "label",
    source: "label",
  }, 1500).calories, 630);
});

test("recognitionNeedsPortionRescale catches unscaled label bottle totals", () => {
  const item = {
    dishName: "Пиво светлое",
    calories: 42,
    carbs: 28,
    portionGrams: 1500,
    photoKind: "label" as const,
    source: "label" as const,
  };

  assert.equal(recognitionNeedsPortionRescale(item, 42), true);
  assert.equal(recognitionNeedsPortionRescale(item, 630), false);
  assert.equal(recognitionNeedsPortionRescale({ ...item, portionGrams: 100 }, 42), false);
});

test("shouldSkipSlowPostVisionEnrichment skips GigaChat backfill for label calories", () => {
  assert.equal(
    shouldSkipSlowPostVisionEnrichment({
      photoKind: "label",
      source: "label",
      calories: 38,
    }),
    true,
  );
  assert.equal(
    shouldSkipSlowPostVisionEnrichment({
      photoKind: "meal",
      source: "gigachat",
      calories: 38,
    }),
    false,
  );
});
