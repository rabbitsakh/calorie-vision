import assert from "node:assert/strict";
import { test } from "node:test";
import { parseFoodRecognitionResponse } from "./ai/parse-response.ts";
import { nutritionFromPer100g } from "./open-food-facts.ts";

test("parses a nutrition-label vision response and scales from 100g", () => {
  const vision = parseFoodRecognitionResponse(`{
    "photoKind": "label",
    "dishName": "Творог 5%",
    "brand": "Домик в деревне",
    "barcode": "",
    "calories": 200,
    "protein": 16,
    "fat": 10,
    "carbs": 4,
    "portionGrams": 200,
    "per100g": { "calories": 121, "protein": 16, "fat": 5, "carbs": 3 },
    "confidence": 0.9,
    "alternatives": []
  }`);

  assert.equal(vision.photoKind, "label");
  assert.equal(vision.per100g?.calories, 121);
  const scaled = nutritionFromPer100g(vision.per100g!, 200);
  assert.equal(scaled?.calories, 242);
  assert.equal(scaled?.portionGrams, 200);
  assert.equal(scaled?.protein, 32);
});

test("parses several dishes from a mixed plate", () => {
  const vision = parseFoodRecognitionResponse(`{
    "photoKind": "meal",
    "dishName": "Стейк, картофель, салат",
    "calories": 670,
    "protein": 46,
    "fat": 33,
    "carbs": 32,
    "portionGrams": 430,
    "confidence": 0.6,
    "items": [
      { "dishName": "Стейк", "calories": 400, "protein": 40, "fat": 20, "carbs": 0, "portionGrams": 150, "confidence": 0.7 },
      { "dishName": "Картофель", "calories": 180, "protein": 4, "fat": 6, "carbs": 28, "portionGrams": 200, "confidence": 0.8 },
      { "dishName": "Салат", "calories": 90, "protein": 2, "fat": 7, "carbs": 4, "portionGrams": 80, "confidence": 0.6 }
    ]
  }`);

  assert.equal(vision.items?.length, 3);
  assert.equal(vision.items?.[0].dishName, "Стейк");
  assert.equal(vision.items?.[1].calories, 180);
});

test("parses a package barcode from the vision JSON", () => {
  const vision = parseFoodRecognitionResponse(`{
    "photoKind": "barcode",
    "dishName": "Молоко 3.2%",
    "brand": "Простоквашино",
    "barcode": "460 0605 023124",
    "calories": 60,
    "protein": 3,
    "fat": 3.2,
    "carbs": 4.7,
    "portionGrams": 200,
    "per100g": { "calories": 0, "protein": 0, "fat": 0, "carbs": 0 },
    "confidence": 0.7,
    "alternatives": []
  }`);

  assert.equal(vision.photoKind, "barcode");
  assert.equal(vision.barcode, "460 0605 023124");
  assert.equal(vision.brand, "Простоквашино");
});

test("parses fiber and sugar on meal and alternatives", () => {
  const vision = parseFoodRecognitionResponse(`{
    "photoKind": "meal",
    "dishName": "Борщ с мясом",
    "calories": 280,
    "protein": 14,
    "fat": 12,
    "carbs": 28,
    "fiber": 4.5,
    "sugar": 5,
    "portionGrams": 350,
    "confidence": 0.86,
    "alternatives": [
      { "dishName": "Щи", "calories": 220, "protein": 10, "fat": 8, "carbs": 24, "fiber": 3, "sugar": 4, "portionGrams": 300 }
    ],
    "items": []
  }`);

  assert.equal(vision.fiber, 4.5);
  assert.equal(vision.sugar, 5);
  assert.equal(vision.alternatives?.[0]?.fiber, 3);
  assert.equal(vision.alternatives?.[0]?.sugar, 4);
});

test("keeps zero fiber and sugar for meat dishes", () => {
  const vision = parseFoodRecognitionResponse(`{
    "photoKind": "meal",
    "dishName": "Куриная грудка вареная",
    "calories": 180,
    "protein": 28,
    "fat": 6,
    "carbs": 0,
    "fiber": 0,
    "sugar": 0,
    "portionGrams": 150,
    "confidence": 0.9,
    "alternatives": [],
    "items": []
  }`);

  assert.equal(vision.fiber, 0);
  assert.equal(vision.sugar, 0);
  assert.equal(vision.carbs, 0);
});

test("promotes a single nested items entry onto the parent", () => {
  const vision = parseFoodRecognitionResponse(`{
    "photoKind": "meal",
    "dishName": "",
    "calories": 0,
    "protein": 0,
    "fat": 0,
    "carbs": 0,
    "portionGrams": 0,
    "confidence": 0.5,
    "items": [
      {
        "dishName": "Овсянка с ягодами",
        "calories": 320,
        "protein": 12,
        "fat": 8,
        "carbs": 48,
        "fiber": 6,
        "sugar": 14,
        "portionGrams": 280,
        "confidence": 0.82
      }
    ]
  }`);

  assert.equal(vision.items, undefined);
  assert.equal(vision.dishName, "Овсянка с ягодами");
  assert.equal(vision.calories, 320);
  assert.equal(vision.protein, 12);
  assert.equal(vision.fiber, 6);
  assert.equal(vision.sugar, 14);
  assert.equal(vision.portionGrams, 280);
});
