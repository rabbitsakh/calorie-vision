import assert from "node:assert/strict";
import { test } from "node:test";
import {
  aggregateMealHistory,
  mergeSuggestions,
  pickHighProteinFromHistory,
  rankHistorySuggestions,
  scoreHistoryForRemaining,
  shouldPinPostWorkoutProtein,
  type HistoryMealCandidate,
} from "./suggestion-history.ts";

const remaining = { calories: 600, protein: 40, fat: 20, carbs: 50 };

const cottage: HistoryMealCandidate = {
  name: "Творог 5%",
  calories: 180,
  protein: 28,
  fat: 8,
  carbs: 6,
  portionGrams: 150,
  count: 8,
  source: "history",
};

const porridge: HistoryMealCandidate = {
  name: "Овсянка",
  calories: 250,
  protein: 8,
  fat: 6,
  carbs: 40,
  portionGrams: 200,
  count: 12,
  source: "history",
};

const chicken: HistoryMealCandidate = {
  name: "Куриная грудка",
  calories: 165,
  protein: 35,
  fat: 3,
  carbs: 0,
  portionGrams: 150,
  count: 4,
  source: "favorite",
};

test("scoreHistoryForRemaining prefers protein when protein remains", () => {
  const proteinScore = scoreHistoryForRemaining(cottage, remaining);
  const carbScore = scoreHistoryForRemaining(porridge, remaining);
  assert.ok(proteinScore > carbScore);
});

test("pickHighProteinFromHistory picks densest protein", () => {
  const pick = pickHighProteinFromHistory([porridge, cottage, chicken], remaining);
  assert.ok(pick);
  assert.match(pick!.name, /Куриная|Творог/i);
  assert.ok(pick!.protein >= 25);
});

test("mergeSuggestions pins post-workout protein first", () => {
  const merged = mergeSuggestions({
    history: [porridge, cottage, chicken],
    others: [
      {
        name: "Гречка с маслом",
        calories: 200,
        protein: 6,
        fat: 8,
        carbs: 30,
        portionGrams: 150,
        why: "fallback",
        category: "carbs",
      },
    ],
    remaining,
    pinProteinFirst: true,
  });
  assert.equal(merged.length, 3);
  assert.match(merged[0]!.why, /зала/i);
  assert.ok(merged[0]!.protein >= 15);
  // History fills remaining slots before generic fallback.
  assert.ok(merged.every((s) => !/Гречка/i.test(s.name)) || merged.length === 3);
  assert.ok(merged.some((s) => /Куриная|Творог/i.test(s.name)));
});

test("mergeSuggestions without pin still prefers history fill", () => {
  const merged = mergeSuggestions({
    history: [cottage],
    others: [
      {
        name: "Омлет из 2 яиц с зеленью",
        calories: 220,
        protein: 14,
        fat: 12,
        carbs: 2,
        portionGrams: 120,
        why: "fallback",
        category: "balanced",
      },
    ],
    remaining,
    pinProteinFirst: false,
  });
  assert.equal(merged[0]!.name, "Творог 5%");
  assert.match(merged[0]!.why, /Часто|избранн/i);
});

test("aggregateMealHistory requires min count", () => {
  const agg = aggregateMealHistory(
    [
      { dishName: "Творог", calories: 100, protein: 20, portionGrams: 100 },
      { dishName: "Творог", calories: 110, protein: 22, portionGrams: 100 },
      { dishName: "Разовое", calories: 50, protein: 1, portionGrams: 50 },
    ],
    2,
  );
  assert.equal(agg.length, 1);
  assert.equal(agg[0]!.name, "Творог");
  assert.equal(agg[0]!.count, 2);
});

test("shouldPinPostWorkoutProtein", () => {
  assert.equal(
    shouldPinPostWorkoutProtein({
      postWorkoutParam: true,
      gymToday: false,
      eatenProtein: 100,
      proteinTarget: 120,
    }),
    true,
  );
  assert.equal(
    shouldPinPostWorkoutProtein({
      gymToday: true,
      eatenProtein: 50,
      proteinTarget: 120,
    }),
    true,
  );
  assert.equal(
    shouldPinPostWorkoutProtein({
      gymToday: true,
      eatenProtein: 100,
      proteinTarget: 120,
    }),
    false,
  );
  assert.equal(
    shouldPinPostWorkoutProtein({
      gymToday: false,
      eatenProtein: 10,
      proteinTarget: 120,
    }),
    false,
  );
});

test("rankHistorySuggestions dedupes and limits", () => {
  const ranked = rankHistorySuggestions(
    [
      cottage,
      { ...cottage, name: "творог 5%", count: 3 },
      porridge,
      chicken,
    ],
    remaining,
    2,
  );
  assert.equal(ranked.length, 2);
  const names = ranked.map((s) => s.name.toLowerCase());
  assert.equal(new Set(names).size, 2);
});
