import assert from "node:assert/strict";
import { test } from "node:test";
import { dishLooksLikeAlcohol, lookupRuNutritionTable, scaleRuNutritionToGrams } from "./ru-nutrition-lookup.ts";

test("lookupRuNutritionTable matches borscht", () => {
  const hit = lookupRuNutritionTable("Домашний борщ");
  assert.ok(hit);
  assert.match(hit!.dishName, /Борщ/i);
  assert.ok(hit!.calories >= 200);
});

test("lookupRuNutritionTable matches buckwheat synonym", () => {
  const hit = lookupRuNutritionTable("Гречка с маслом");
  assert.ok(hit);
  assert.match(hit!.dishName, /Греч/i);
});

test("lookupRuNutritionTable returns null for unknown dish", () => {
  assert.equal(lookupRuNutritionTable("xyz"), null);
});

test("lookupRuNutritionTable matches milk not coffee latte", () => {
  const hit = lookupRuNutritionTable("молоко");
  assert.ok(hit);
  assert.match(hit!.dishName, /Молоко/i);
  assert.doesNotMatch(hit!.dishName, /Кофе|латте/i);
});

test("lookupRuNutritionTable matches milk with fat percent", () => {
  const hit = lookupRuNutritionTable("Молоко 3.2%");
  assert.ok(hit);
  assert.match(hit!.dishName, /Молоко/i);
});

test("lookupRuNutritionTable still matches coffee queries", () => {
  const hit = lookupRuNutritionTable("кофе");
  assert.ok(hit);
  assert.match(hit!.dishName, /Кофе/i);
});

test("lookupRuNutritionTable matches rice milk not boiled rice", () => {
  const hit = lookupRuNutritionTable("рисовое молоко");
  assert.ok(hit);
  assert.match(hit!.dishName, /Рисовое молоко/i);
});

test("lookupRuNutritionTable matches plain rice", () => {
  const hit = lookupRuNutritionTable("рис");
  assert.ok(hit);
  assert.match(hit!.dishName, /Рис/i);
  assert.doesNotMatch(hit!.dishName, /молоко/i);
});

test("lookupRuNutritionTable matches new staples", () => {
  const semolina = lookupRuNutritionTable("манная каша");
  assert.ok(semolina);
  assert.match(semolina!.dishName, /Манная/i);

  const chickenSoup = lookupRuNutritionTable("куриный суп");
  assert.ok(chickenSoup);
  assert.match(chickenSoup!.dishName, /Куриный суп/i);

  const friedPotato = lookupRuNutritionTable("жареный картофель");
  assert.ok(friedPotato);
  assert.match(friedPotato!.dishName, /Картофель жареный/i);
});

test("lookupRuNutritionTable matches expanded staples", () => {
  const okroshka = lookupRuNutritionTable("окрошка");
  assert.ok(okroshka);
  assert.match(okroshka!.dishName, /Окрошка/i);

  const millet = lookupRuNutritionTable("пшенная каша");
  assert.ok(millet);
  assert.match(millet!.dishName, /Пшён/i);

  const pie = lookupRuNutritionTable("пирожок с мясом");
  assert.ok(pie);
  assert.match(pie!.dishName, /Пирожок/i);
});

test("lookupRuNutritionTable matches brand packs", () => {
  const doshirak = lookupRuNutritionTable("доширак");
  assert.ok(doshirak);
  assert.match(doshirak!.dishName, /Доширак/i);
  assert.equal(doshirak!.brand, "Доширак");

  const actimel = lookupRuNutritionTable("актимель");
  assert.ok(actimel);
  assert.match(actimel!.dishName, /Actimel/i);

  const prostokvashino = lookupRuNutritionTable("кефир простоквашино");
  assert.ok(prostokvashino);
  assert.match(prostokvashino!.dishName, /Простоквашино/i);
});

test("lookupRuNutritionTable and dishLooksLikeAlcohol for drinks", () => {
  const beer = lookupRuNutritionTable("пиво");
  assert.ok(beer);
  assert.match(beer!.dishName, /Пиво/i);
  assert.equal(dishLooksLikeAlcohol("пиво светлое"), true);
  assert.equal(dishLooksLikeAlcohol("водка"), true);
  assert.equal(dishLooksLikeAlcohol("борщ"), false);
});

test("scaleRuNutritionToGrams scales portion macros", () => {
  const full = lookupRuNutritionTable("банан");
  assert.ok(full);
  const half = scaleRuNutritionToGrams("банан", full!.portionGrams / 2);
  assert.ok(half);
  assert.equal(half!.calories, Math.round(full!.calories / 2));
});
