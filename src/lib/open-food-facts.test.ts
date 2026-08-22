import assert from "node:assert/strict";
import { test } from "node:test";
import {
  offMatchesQuery,
  offProductToNutrition,
  parsePackGrams,
  nutritionFromPer100g,
  resolvePackGrams,
} from "./open-food-facts.ts";

test("parses net weight from package quantity text", () => {
  assert.equal(parsePackGrams("250 г"), 250);
  assert.equal(parsePackGrams("120 г"), 120);
  assert.equal(parsePackGrams("930 г"), 930);
  assert.equal(parsePackGrams("500g"), 500);
  assert.equal(parsePackGrams("0.33 kg"), 330);
  assert.equal(parsePackGrams("1 кг"), 1000);
  assert.equal(parsePackGrams("330 мл"), 330);
  assert.equal(parsePackGrams("50.0g"), 50);
  assert.equal(parsePackGrams(180), 180);
});

test("uses serving size when net quantity is missing", () => {
  const { grams, explicit } = resolvePackGrams({
    quantity: "",
    serving_size: "50.0g",
    serving_quantity: 50,
  });
  assert.equal(grams, 50);
  assert.equal(explicit, true);
});

test("scales 100g nutrition to the pack weight", () => {
  const scaled = nutritionFromPer100g({ calories: 200, protein: 10, fat: 8, carbs: 20 }, 250);
  assert.deepEqual(scaled, {
    dishName: "",
    calories: 500,
    protein: 25,
    fat: 20,
    carbs: 50,
    fiber: undefined,
    sugar: undefined,
    portionGrams: 250,
  });
});

test("scales fiber and sugar from OFF per-100g values", () => {
  const scaled = nutritionFromPer100g(
    { calories: 100, protein: 2, fat: 1, carbs: 20, fiber: 4, sugar: 10 },
    200,
  );
  assert.equal(scaled?.fiber, 8);
  assert.equal(scaled?.sugar, 20);
});

test("reads string sugars_100g and sugars fallback from OFF", () => {
  const fromString = offProductToNutrition({
    product_name: "Батончик",
    quantity: "40 г",
    nutriments: {
      "energy-kcal_100g": "250",
      proteins_100g: "25",
      fat_100g: "16",
      carbohydrates_100g: "8.5",
      fiber_100g: "38",
      sugars_100g: "3,2",
    },
  });
  assert.equal(fromString?.portionGrams, 40);
  assert.equal(fromString?.fiber, 15.2);
  assert.equal(fromString?.sugar, 1.3);

  const fromSugarsKey = offProductToNutrition({
    product_name: "Батончик",
    quantity: "40 г",
    nutriments: {
      "energy-kcal_100g": 250,
      proteins_100g: 25,
      fat_100g: 16,
      carbohydrates_100g: 8.5,
      fiber_100g: 38,
      sugars: 5,
    },
  });
  assert.equal(fromSugarsKey?.sugar, 2);
});

test("converts energy-kj_100g when kcal_100g is missing", () => {
  const nutrition = offProductToNutrition({
    product_name: "Сок",
    quantity: "200 мл",
    nutriments: {
      "energy-kj_100g": 180,
      proteins_100g: 0.5,
      fat_100g: 0,
      carbohydrates_100g: 10,
      sugars_100g: 9,
    },
  });
  assert.ok(nutrition);
  // 180 kJ / 4.184 ≈ 43.0 kcal/100g → 86 kcal for 200 g
  assert.equal(nutrition?.calories, 86);
  assert.equal(nutrition?.sugar, 18);
});

test("converts an Open Food Facts product to a portion", () => {
  const nutrition = offProductToNutrition({
    code: "4600605023124",
    brands: "Простоквашино",
    product_name: "Кефир 2.5%",
    quantity: "930 г",
    nutriments: {
      "energy-kcal_100g": 51,
      proteins_100g: 3,
      fat_100g: 2.5,
      carbohydrates_100g: 4.1,
    },
    image_front_url: "https://images.openfoodfacts.org/images/products/460/kefir.jpg",
  });

  assert.ok(nutrition);
  assert.equal(nutrition?.dishName, "Простоквашино Кефир 2.5%");
  assert.equal(nutrition?.portionGrams, 100);
  assert.equal(nutrition?.calories, 51);
  assert.equal(nutrition?.imageUrl, "https://images.openfoodfacts.org/images/products/460/kefir.jpg");
});

test("uses the full pack when it looks like a single serving", () => {
  const nutrition = offProductToNutrition({
    product_name: "Йогурт",
    quantity: "120 г",
    nutriments: { "energy-kcal_100g": 80, proteins_100g: 4, fat_100g: 3, carbohydrates_100g: 10 },
  });
  assert.equal(nutrition?.portionGrams, 120);
  assert.equal(nutrition?.calories, 96);
});

test("decodes HTML entities in Open Food Facts names", () => {
  const nutrition = offProductToNutrition({
    brands: "ООО &quot;КДВ Воронеж&quot;",
    product_name: "Zebra",
    quantity: "40 г",
    nutriments: { "energy-kcal_100g": 500, proteins_100g: 8, fat_100g: 27, carbohydrates_100g: 55 },
  });

  assert.equal(nutrition?.dishName, 'ООО "КДВ Воронеж" Zebra');
  assert.equal(nutrition?.brand, 'ООО "КДВ Воронеж"');
});

test("accepts Open Food Facts hits that share product tokens", () => {
  assert.equal(offMatchesQuery("Простоквашино кефир", "Простоквашино Кефир 2.5%"), true);
  assert.equal(offMatchesQuery("борщ", "Шоколад Milka"), false);
});

test("uses serving weight for a single snack bar in Open Food Facts", () => {
  const nutrition = offProductToNutrition({
    code: "4610169560862",
    product_name: "Pistachios & Caramel",
    brands: "SNAQER",
    quantity: "",
    serving_size: "50.0g",
    serving_quantity: 50,
    nutriments: {
      "energy-kcal_100g": 449,
      proteins_100g: 15,
      fat_100g: 20,
      carbohydrates_100g: 45,
    },
  });

  assert.ok(nutrition);
  assert.equal(nutrition?.portionGrams, 50);
  assert.equal(nutrition?.calories, 225);
  assert.equal(nutrition?.explicitPackGrams, true);
});

test("defaults a snack bar without net weight to 60 g", () => {
  const nutrition = offProductToNutrition({
    code: "4680046724434",
    product_name: "Natural bar pudding",
    brands: "Bombbar",
    nutriments: {
      "energy-kcal_100g": 291.666666666667,
      proteins_100g: 33.3333333333333,
      fat_100g: 7.16666666666667,
      carbohydrates_100g: 6.66666666666667,
    },
  });

  assert.equal(nutrition?.portionGrams, 60);
  assert.equal(nutrition?.calories, 175);
  assert.equal(nutrition?.protein, 20);
  assert.equal(nutrition?.explicitPackGrams, true);
});

test("reads bar weight from the product name", () => {
  const nutrition = offProductToNutrition({
    product_name: "Протеиновый батончик 40 г",
    nutriments: { "energy-kcal_100g": 400, proteins_100g: 25, fat_100g: 12, carbohydrates_100g: 30 },
  });
  assert.equal(nutrition?.portionGrams, 40);
  assert.equal(nutrition?.calories, 160);
});
