import assert from "node:assert/strict";
import { test } from "node:test";
import { explainWhyTheseCalories } from "./confirm-why-explanation.ts";

test("photo meal: source + portion basis", () => {
  const why = explainWhyTheseCalories({
    dishName: "Борщ",
    calories: 320,
    confidence: 0.82,
    source: "gigachat",
    photoKind: "meal",
    portionGrams: 280,
  });
  assert.match(why.summary, /фото|порци/i);
  assert.equal(why.detail, null);
});

test("OFF barcode: database + per100 math", () => {
  const why = explainWhyTheseCalories({
    dishName: "Молоко",
    brand: "Простоквашино",
    calories: 130,
    confidence: 0.9,
    source: "openfoodfacts-barcode",
    photoKind: "barcode",
    portionGrams: 250,
    per100g: { calories: 52, protein: 3, fat: 2.5, carbs: 4.7 },
  });
  assert.match(why.summary, /штрихкод|баз/i);
  assert.match(why.summary, /52|250|100/);
});

test("AI barcode: source label", () => {
  const why = explainWhyTheseCalories({
    dishName: "Йогурт",
    calories: 90,
    confidence: 0.7,
    source: "gigachat-barcode",
    photoKind: "barcode",
    portionGrams: 125,
  });
  assert.match(why.summary, /штрихкод/i);
});

test("label per100", () => {
  const why = explainWhyTheseCalories({
    dishName: "Творог",
    calories: 180,
    confidence: 0.85,
    source: "label",
    photoKind: "label",
    portionGrams: 150,
    per100g: { calories: 120 },
  });
  assert.match(why.summary, /этикетк/i);
});

test("text generic lookupMode", () => {
  const why = explainWhyTheseCalories({
    dishName: "Гречка",
    calories: 200,
    confidence: 0.8,
    source: "gigachat-lookup",
    lookupMode: "generic",
    portionGrams: 200,
  });
  assert.match(why.summary, /Типичные|средн/i);
});

test("text branded lookupMode", () => {
  const why = explainWhyTheseCalories({
    dishName: "Творог 5%",
    brand: "Простоквашино",
    calories: 110,
    confidence: 0.8,
    source: "gigachat-lookup",
    lookupMode: "branded",
  });
  assert.match(why.summary, /Простоквашино|бренд/i);
});

test("correction memory", () => {
  const why = explainWhyTheseCalories({
    dishName: "Овсянка",
    calories: 250,
    confidence: 0.95,
    source: "correction-memory",
    portionGrams: 250,
  });
  assert.match(why.summary, /прошл|исправлен/i);
});

test("low confidence adds detail", () => {
  const why = explainWhyTheseCalories({
    dishName: "Что-то на тарелке",
    calories: 400,
    confidence: 0.3,
    source: "gigachat",
    photoKind: "meal",
    portionGrams: 300,
  });
  assert.ok(why.detail);
  assert.match(why.detail!, /провер|неуверен|неоднознач/i);
});
