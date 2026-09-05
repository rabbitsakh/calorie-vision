import assert from "node:assert/strict";
import { test } from "node:test";
import {
  estimateKcalPer100,
  isSuspiciousSoupOnPackaged,
  looksLikeGrainPackName,
  looksLikeSoupName,
  inferInstantGrainFallbackName,
  repairPackagedMislabel,
} from "./package-name-guard.ts";

test("detects soup names", () => {
  assert.equal(looksLikeSoupName("суп Том Ям"), true);
  assert.equal(looksLikeSoupName("борщ"), true);
  assert.equal(looksLikeSoupName("Овсянка"), false);
});

test("detects grain pack names", () => {
  assert.equal(looksLikeGrainPackName("ОВСЯНКА ПО-НОВОМУ"), true);
  assert.equal(looksLikeGrainPackName("геркулес"), true);
  assert.equal(looksLikeGrainPackName("том ям"), false);
});

test("flags instant cup misread as soup", () => {
  const result = {
    dishName: "суп Том Ям",
    calories: 148,
    confidence: 0.8,
    photoKind: "package" as const,
    portionGrams: 40,
  };
  assert.equal(isSuspiciousSoupOnPackaged(result), true);
  assert.equal(estimateKcalPer100(result), 370);
});

test("repairs soup mislabel using brand text", () => {
  const repaired = repairPackagedMislabel({
    dishName: "суп Том Ям",
    brand: "Овсянка по-новому клубника",
    calories: 148,
    confidence: 0.8,
    photoKind: "package",
    portionGrams: 40,
  });
  assert.match(repaired.dishName, /овсян/i);
  assert.ok(repaired.confidence <= 0.72);
});

test("repairs soup mislabel using dense instant cup fallback", () => {
  const repaired = repairPackagedMislabel({
    dishName: "суп Том Ям",
    calories: 148,
    confidence: 0.8,
    photoKind: "package",
    portionGrams: 40,
  });
  assert.equal(repaired.dishName, "Каша быстрого приготовления");
  assert.ok(repaired.confidence <= 0.68);
});

test("does not repair real soup on plate", () => {
  const result = {
    dishName: "суп Том Ям",
    calories: 280,
    confidence: 0.85,
    photoKind: "meal" as const,
    portionGrams: 350,
  };
  assert.equal(isSuspiciousSoupOnPackaged(result), false);
  assert.equal(repairPackagedMislabel(result).dishName, "суп Том Ям");
});

test("infers buckwheat fallback from brand cues", () => {
  assert.equal(inferInstantGrainFallbackName("Гречка по-купечески"), "Гречка быстрого приготовления");
  const repaired = repairPackagedMislabel({
    dishName: "суп Том Ям",
    brand: "Гречка Экстра",
    calories: 148,
    confidence: 0.8,
    photoKind: "package",
    portionGrams: 40,
  });
  // brand itself is grain-like → used as dishName
  assert.match(repaired.dishName, /гречк/i);
});

test("dense cup without grain cues falls back to generic porridge", () => {
  assert.equal(inferInstantGrainFallbackName("стакан 40г"), "Каша быстрого приготовления");
});
