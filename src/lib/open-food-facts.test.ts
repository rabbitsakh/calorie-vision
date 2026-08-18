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
    portionGrams: 250,
  });
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
  });

  assert.ok(nutrition);
  assert.equal(nutrition?.dishName, "Простоквашино Кефир 2.5%");
  assert.equal(nutrition?.portionGrams, 100);
  assert.equal(nutrition?.calories, 51);
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
