import assert from "node:assert/strict";
import { test } from "node:test";
import {
  dishLooksLikeAlcohol,
  listRuNutritionByBrand,
  lookupRuNutritionBranded,
  lookupRuNutritionTable,
  scaleRuNutritionToGrams,
} from "./ru-nutrition-lookup.ts";

test("lookupRuNutritionTable matches boiled egg not pouch egg", () => {
  const boiled = lookupRuNutritionTable("вареное яйцо");
  assert.equal(boiled?.dishName, "Вареное яйцо");
  const soft = lookupRuNutritionTable("яйцо в мешочек");
  assert.equal(soft?.dishName, "Яйцо в мешочек");
  const fried = lookupRuNutritionTable("яичница");
  assert.equal(fried?.dishName, "Яичница");
});

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

test("soup / cottage / branded milk are not rewritten to wrong staples", () => {
  assert.match(lookupRuNutritionTable("суп")!.dishName, /Овощной суп/i);
  assert.doesNotMatch(lookupRuNutritionTable("суп")!.dishName, /Куриный/i);

  const seafood = lookupRuNutritionTable("суп с морепродуктами");
  assert.ok(seafood);
  assert.match(seafood!.dishName, /морепродукт/i);
  assert.doesNotMatch(seafood!.dishName, /Куриный/i);

  const haemul = lookupRuNutritionTable("хемультан");
  assert.ok(haemul);
  assert.match(haemul!.dishName, /морепродукт/i);

  assert.match(lookupRuNutritionTable("творог")!.dishName, /Творог 5%/i);
  assert.match(lookupRuNutritionTable("творог обезжиренный")!.dishName, /обезжирен/i);
  assert.match(lookupRuNutritionTable("творог обезжиренный 0%")!.dishName, /обезжирен/i);
  assert.equal(
    lookupRuNutritionTable("творог обезжиренный 0%", { unbrandedOnly: true })!.brand,
    undefined,
  );
  assert.match(
    lookupRuNutritionTable("серышевский творог обезжиренный")!.dishName,
    /обезжирен/i,
  );

  // High-protein Bombbar (typo Bobbbar) — not generic 2.5%.
  const bobb = lookupRuNutritionTable("молоко Bobbbar 35г протеина 1,8%");
  assert.ok(bobb);
  assert.match(bobb!.dishName, /Bombbar|бомббар/i);
  assert.ok((bobb!.protein ?? 0) >= 15);
  assert.doesNotMatch(bobb!.dishName, /2[,.]5/);
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

test("lookupRuNutritionBranded and listRuNutritionByBrand", () => {
  const cottage = lookupRuNutritionBranded("творог", "Простоквашино");
  assert.ok(cottage);
  assert.match(cottage!.dishName, /Творог.*Простоквашино|Простоквашино/i);
  assert.equal(cottage!.brand, "Простоквашино");

  const list = listRuNutritionByBrand("Простоквашино", 5);
  assert.ok(list.length >= 2);
  assert.ok(list.every((row) => row.brand === "Простоквашино"));
});

test("generic dairy fat variants", () => {
  assert.match(lookupRuNutritionTable("творог 9%")!.dishName, /9%/);
  assert.match(lookupRuNutritionTable("творог 2%")!.dishName, /2%/);
  assert.match(lookupRuNutritionTable("кефир 1%")!.dishName, /1%/);
  assert.match(lookupRuNutritionTable("кефир 0%")!.dishName, /1%/);
  assert.match(lookupRuNutritionTable("молоко обезжиренное")!.dishName, /обезжир/i);
  const milk25 = lookupRuNutritionTable("молоко 2,5%", { unbrandedOnly: true });
  assert.ok(milk25);
  assert.match(milk25!.dishName, /Молоко 2[,.]5%/i);
  assert.doesNotMatch(milk25!.dishName, /безлактоз|1[,.]5%/i);
  assert.equal(milk25!.fat, 2.5);
});

test("generic dairy staples stay unbranded", () => {
  for (const q of [
    "кефир",
    "кефир 1%",
    "молоко 2,5%",
    "сметана",
    "йогурт",
    "ряженка",
    "варенец",
    "айран",
    "тан",
    "мацони",
    "питьевой йогурт",
  ]) {
    const hit = lookupRuNutritionTable(q, { unbrandedOnly: true });
    assert.ok(hit, `expected unbranded hit for ${q}`);
    assert.equal(hit!.brand, undefined, q);
  }
  assert.match(lookupRuNutritionTable("йогурт")!.dishName, /натуральн/i);
  assert.match(lookupRuNutritionTable("греческий йогурт")!.dishName, /Греческ/i);
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
  if (full!.fiber != null) {
    assert.equal(half!.fiber, Math.round((full!.fiber / 2) * 10) / 10);
  }
  if (full!.sugar != null) {
    assert.equal(half!.sugar, Math.round((full!.sugar / 2) * 10) / 10);
  }
});
