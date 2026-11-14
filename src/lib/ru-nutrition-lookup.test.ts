import assert from "node:assert/strict";
import { test } from "node:test";
import { alcoholEnergyKcal, atwaterKcal } from "./nutrition-consistency.ts";
import {
  dishLooksLikeAlcohol,
  listRuNutritionByBrand,
  lookupRuNutritionBranded,
  lookupRuNutritionTable,
  RU_NUTRITION_ENTRIES,
  scaleRuNutritionToGrams,
} from "./ru-nutrition-lookup.ts";

test("lookupRuNutritionTable matches boiled egg not pouch egg", () => {
  const boiled = lookupRuNutritionTable("вареное яйцо");
  assert.equal(boiled?.dishName, "Вареное яйцо");
  const soft = lookupRuNutritionTable("яйцо в мешочек");
  assert.equal(soft?.dishName, "Яйцо в мешочек");
  const fried = lookupRuNutritionTable("яичница");
  assert.equal(fried?.dishName, "Яичница");
  assert.equal(lookupRuNutritionTable("варёных яйца")?.dishName, "Вареное яйцо");
  assert.equal(lookupRuNutritionTable("вареные яйца")?.dishName, "Вареное яйцо");
});

test("творожный сырок is soft pack not glazed 50г bar", () => {
  const soft = lookupRuNutritionTable("творожный сырок");
  assert.ok(soft);
  assert.match(soft!.dishName, /Творожный сырок/i);
  assert.equal(soft!.portionGrams, 100);
  const scaled = scaleRuNutritionToGrams("творожный сырок", 200);
  assert.ok(scaled);
  assert.equal(scaled!.calories, 300);
  const glazed = lookupRuNutritionTable("глазированный сырок");
  assert.ok(glazed);
  assert.match(glazed!.dishName, /Глазирован/i);
  assert.equal(glazed!.portionGrams, 50);
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

test("lookupRuNutritionTable matches protein isolate powder", () => {
  const hit = lookupRuNutritionTable("протеин изолят");
  assert.ok(hit);
  assert.match(hit!.dishName, /Протеин изолят/i);
  assert.ok(hit!.protein != null && hit!.protein >= 80);
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
  assert.equal(milk25!.portionGrams, 250);
  assert.equal(milk25!.fat, 6.3);
  assert.equal(milk25!.protein, 7);
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
  assert.match(lookupRuNutritionTable("ряженка")!.dishName, /Ряженка/);
  assert.doesNotMatch(lookupRuNutritionTable("ряженка")!.dishName, /желе/i);
  const jelly = lookupRuNutritionTable("желе из ряженки");
  assert.equal(jelly?.dishName, "Желе из ряженки");
  assert.equal(jelly?.calories, 85);
  assert.equal(jelly?.portionGrams, 150);
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

test("окорочок и куриное бедро: гриль с кожей и без", () => {
  const grill = lookupRuNutritionTable("Окорочок гриль куриный");
  assert.ok(grill);
  assert.equal(grill!.dishName, "Окорочок куриный гриль");
  assert.equal(grill!.portionGrams, 200);
  assert.equal(grill!.calories, 470);
  assert.equal(grill!.protein, 44);
  assert.equal(grill!.fat, 30);
  assert.equal(grill!.carbs, 0);
  const per100 = scaleRuNutritionToGrams("окорочок гриль", 100);
  assert.equal(per100?.calories, 235);
  assert.equal(per100?.protein, 22);
  assert.equal(per100?.fat, 15);
  assert.equal(per100?.carbs, 0);
  assert.equal(lookupRuNutritionTable("куриное бедро")?.calories, 470);
  assert.equal(lookupRuNutritionTable("окорочок жареный")?.dishName, grill!.dishName);
  assert.equal(lookupRuNutritionTable("бедро запеченное")?.calories, 470);
  assert.equal(lookupRuNutritionTable("окорочок на гриле")?.dishName, grill!.dishName);

  const skinless = lookupRuNutritionTable("окорочок без кожи");
  assert.ok(skinless);
  assert.equal(skinless!.dishName, "Окорочок куриный без кожи");
  assert.equal(skinless!.portionGrams, 200);
  assert.equal(skinless!.calories, 360);
  assert.equal(skinless!.protein, 48);
  assert.equal(skinless!.fat, 18);
  assert.equal(skinless!.carbs, 0);
  const skinless100 = scaleRuNutritionToGrams("куриное бедро без кожи", 100);
  assert.equal(skinless100?.calories, 180);
  assert.equal(skinless100?.protein, 24);
  assert.equal(skinless100?.fat, 9);
  assert.match(lookupRuNutritionTable("окорочок гриль без кожи")!.dishName, /без кожи/);
  assert.doesNotMatch(lookupRuNutritionTable("окорочок гриль куриный")!.dishName, /без кожи/);
});

test("справочник: Атуотер ±20% и масса БЖУ не больше порции", () => {
  for (const entry of RU_NUTRITION_ENTRIES) {
    const protein = entry.protein ?? 0;
    const fat = entry.fat ?? 0;
    const carbs = entry.carbs ?? 0;
    const mass = protein + fat + carbs;
    assert.ok(
      mass <= entry.portionGrams + 0.05,
      `${entry.dishName}: БЖУ ${mass} г > порции ${entry.portionGrams} г`,
    );
    const ethanol = entry.isAlcohol ? alcoholEnergyKcal(entry.dishName, entry.portionGrams) : 0;
    const expected = atwaterKcal(protein, fat, carbs) + ethanol;
    const gap = Math.abs(entry.calories - expected) / Math.max(entry.calories, expected, 1);
    assert.ok(
      gap <= 0.2,
      `${entry.dishName}: ${entry.calories} ккал vs Атуотер ${expected.toFixed(1)} (${Math.round(gap * 100)}%)`,
    );
  }
});

test("поиск находит винительный падеж и тарелку борща", () => {
  assert.match(lookupRuNutritionTable("гречку")!.dishName, /Гречн/i);
  assert.match(lookupRuNutritionTable("шаурму")!.dishName, /Шаурма/);
  assert.match(lookupRuNutritionTable("пиццу")!.dishName, /Пицца/);
  assert.match(lookupRuNutritionTable("тарелку борща")!.dishName, /Борщ/);
  assert.match(lookupRuNutritionTable("курицу")!.dishName, /Курица/);
});

test("кофе разделён: чёрный, с молоком, капучино, латте, эспрессо", () => {
  const black = lookupRuNutritionTable("кофе");
  assert.match(black!.dishName, /чёрн/i);
  assert.ok(black!.calories <= 5);
  assert.match(lookupRuNutritionTable("американо")!.dishName, /чёрн/i);
  assert.match(lookupRuNutritionTable("эспрессо")!.dishName, /Эспрессо/);
  assert.equal(lookupRuNutritionTable("эспрессо")!.calories, 2);
  assert.match(lookupRuNutritionTable("кофе с молоком")!.dishName, /с молоком/);
  assert.match(lookupRuNutritionTable("капучино")!.dishName, /Капучино/);
  assert.match(lookupRuNutritionTable("латте")!.dishName, /латте/i);
  assert.doesNotMatch(lookupRuNutritionTable("кофе")!.dishName, /латте/i);
});

test("новые строки справочника: сало, орехи, шоколад, кола, роллы, курица", () => {
  assert.match(lookupRuNutritionTable("сало")!.dishName, /Сало/);
  assert.match(lookupRuNutritionTable("миндаль")!.dishName, /Миндаль/);
  assert.match(lookupRuNutritionTable("семечки")!.dishName, /Семечки/);
  assert.match(lookupRuNutritionTable("шоколад")!.dishName, /молочн/i);
  assert.match(lookupRuNutritionTable("горький шоколад")!.dishName, /горьк/i);
  assert.match(lookupRuNutritionTable("хлебцы")!.dishName, /Хлебцы/);
  assert.match(lookupRuNutritionTable("кола")!.dishName, /^Кола$/);
  assert.match(lookupRuNutritionTable("кола без сахара")!.dishName, /без сахара/);
  assert.ok(lookupRuNutritionTable("кола без сахара")!.calories <= 5);
  assert.match(lookupRuNutritionTable("энергетик")!.dishName, /Энергетик/);
  assert.match(lookupRuNutritionTable("халва")!.dishName, /Халва/);
  assert.match(lookupRuNutritionTable("филадельфия")!.dishName, /Филадельфия/);
  assert.equal(lookupRuNutritionTable("филадельфия 100 г")!.portionGrams, 100);
  assert.equal(lookupRuNutritionTable("филадельфия 1 шт")!.portionGrams, 35);
  assert.equal(lookupRuNutritionTable("калифорния 100 г")!.portionGrams, 100);
  assert.equal(lookupRuNutritionTable("калифорния шт")!.portionGrams, 25);
  assert.match(lookupRuNutritionTable("курица")!.dishName, /^Курица$/);
  const cheese = lookupRuNutritionTable("сыр твёрдый")!;
  assert.equal(cheese.portionGrams, 50);
  assert.equal(cheese.calories, 175);
  const sour = lookupRuNutritionTable("сметана 10%")!;
  assert.ok(Math.abs((sour.calories * 100) / sour.portionGrams - 115) < 8);
  const lean = lookupRuNutritionTable("творог обезжиренный")!;
  assert.ok((lean.protein ?? 0) / lean.portionGrams <= 0.18);
});

test("lookupRuNutritionTable matches peanut butter not pasta", () => {
  const hit = lookupRuNutritionTable("арахисовая паста 15г");
  assert.ok(hit);
  assert.match(hit!.dishName, /арахис/i);
  assert.doesNotMatch(hit!.dishName, /макарон/i);
});
