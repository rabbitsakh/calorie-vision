import assert from "node:assert/strict";
import { test } from "node:test";
import { offBrandAgrees } from "./open-food-facts.ts";

test("offBrandAgrees matches brand field", () => {
  assert.equal(
    offBrandAgrees("Простоквашино", {
      dishName: "Творог 5%",
      calories: 100,
      portionGrams: 100,
      brand: "Простоквашино",
    }),
    true,
  );
});

test("offBrandAgrees rejects other brand", () => {
  assert.equal(
    offBrandAgrees("Простоквашино", {
      dishName: "Творог 5%",
      calories: 100,
      portionGrams: 100,
      brand: "Домик в деревне",
    }),
    false,
  );
});

test("offBrandAgrees accepts brand in dish name", () => {
  assert.equal(
    offBrandAgrees("Bombbar", {
      dishName: "Молоко Bombbar протеиновое",
      calories: 150,
      portionGrams: 250,
    }),
    true,
  );
});
