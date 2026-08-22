import assert from "node:assert/strict";
import { test } from "node:test";
import {
  alternativeNeedsMacroBackfill,
  backfillAlternativeFromPack,
  enrichAlternatives,
  enrichAlternativesFromGigaChat,
  enrichAlternativesFromOff,
  enrichAlternativesFromRuTable,
} from "./recognition-alternatives.ts";

test("alternativeNeedsMacroBackfill detects calories-only alternatives", () => {
  assert.equal(
    alternativeNeedsMacroBackfill({ dishName: "Борщ", calories: 280 }),
    true,
  );
  assert.equal(
    alternativeNeedsMacroBackfill({
      dishName: "Борщ",
      calories: 280,
      protein: 12,
      fat: 14,
      carbs: 22,
    }),
    false,
  );
});

test("enrichAlternativesFromRuTable backfills macros from RU table", () => {
  const enriched = enrichAlternativesFromRuTable({
    dishName: "Щи",
    calories: 220,
    confidence: 0.6,
    alternatives: [
      { dishName: "Борщ с мясом", calories: 280 },
      { dishName: "Цезарь с курицей", calories: 420, protein: 22, fat: 28, carbs: 18 },
    ],
  });

  const borscht = enriched.alternatives?.[0];
  assert.equal(borscht?.protein, 12);
  assert.equal(borscht?.fat, 14);
  assert.equal(borscht?.carbs, 22);

  const caesar = enriched.alternatives?.[1];
  assert.equal(caesar?.protein, 22);
});

test("backfillAlternativeFromPack scales macros to alternative calories", () => {
  const filled = backfillAlternativeFromPack(
    { dishName: "Борщ", calories: 140 },
    {
      dishName: "Борщ с мясом",
      calories: 280,
      protein: 12,
      fat: 14,
      carbs: 22,
      portionGrams: 300,
    },
  );

  assert.equal(filled.protein, 6);
  assert.equal(filled.fat, 7);
  assert.equal(filled.carbs, 11);
});

test("enrichAlternativesFromOff backfills macros from OFF search", async () => {
  const enriched = await enrichAlternativesFromOff(
    {
      dishName: "Паста",
      calories: 420,
      confidence: 0.6,
      alternatives: [{ dishName: "Protein bar chocolate", calories: 220 }],
    },
    {
      search: async () => ({
        dishName: "Protein bar chocolate",
        calories: 220,
        protein: 20,
        fat: 8,
        carbs: 18,
        portionGrams: 60,
      }),
    },
  );

  const alt = enriched.alternatives?.[0];
  assert.equal(alt?.protein, 20);
  assert.equal(alt?.fat, 8);
  assert.equal(alt?.carbs, 18);
});

test("enrichAlternatives prefers RU table then OFF", async () => {
  const enriched = await enrichAlternatives(
    {
      dishName: "Щи",
      calories: 220,
      confidence: 0.6,
      alternatives: [
        { dishName: "Борщ с мясом", calories: 280 },
        { dishName: "Protein bar chocolate", calories: 220 },
      ],
    },
    {
      search: async () => ({
        dishName: "Protein bar chocolate",
        calories: 220,
        protein: 20,
        fat: 8,
        carbs: 18,
        portionGrams: 60,
      }),
    },
  );

  assert.equal(enriched.alternatives?.[0]?.protein, 12);
  assert.equal(enriched.alternatives?.[1]?.protein, 20);
});

test("enrichAlternativesFromGigaChat backfills macros when RU/OFF miss", async () => {
  const enriched = await enrichAlternativesFromGigaChat(
    {
      dishName: "Салат",
      calories: 180,
      confidence: 0.6,
      alternatives: [{ dishName: "Цезарь с курицей", calories: 420 }],
    },
    {
      lookup: async () => ({
        dishName: "Цезарь с курицей",
        calories: 420,
        protein: 22,
        fat: 28,
        carbs: 18,
        confidence: 0.7,
      }),
    },
  );

  const alt = enriched.alternatives?.[0];
  assert.equal(alt?.protein, 22);
  assert.equal(alt?.fat, 28);
  assert.equal(alt?.carbs, 18);
});

test("enrichAlternatives prefers RU table, OFF, then GigaChat", async () => {
  const enriched = await enrichAlternatives(
    {
      dishName: "Щи",
      calories: 220,
      confidence: 0.6,
      alternatives: [
        { dishName: "Борщ с мясом", calories: 280 },
        { dishName: "Exotic salad bowl", calories: 320 },
      ],
    },
    {
      search: async () => null,
      lookup: async (name) => ({
        dishName: name,
        calories: 320,
        protein: 15,
        fat: 12,
        carbs: 30,
        confidence: 0.7,
      }),
    },
  );

  assert.equal(enriched.alternatives?.[0]?.protein, 12);
  assert.equal(enriched.alternatives?.[1]?.protein, 15);
});
