import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { looksLikeDrinkName, looksLikeSnackBarName } from "./portion-unit.ts";

describe("looksLikeDrinkName", () => {
  it("does not treat grapes as wine", () => {
    assert.equal(looksLikeDrinkName("Виноград"), false);
    assert.equal(looksLikeDrinkName("виноград кишмиш"), false);
  });

  it("detects real drinks", () => {
    assert.equal(looksLikeDrinkName("Красное вино"), true);
    assert.equal(looksLikeDrinkName("Пиво светлое"), true);
    assert.equal(looksLikeDrinkName("Апельсиновый сок"), true);
    assert.equal(looksLikeDrinkName("Молоко 2.5%"), true);
    assert.equal(looksLikeDrinkName("Кофе латте"), true);
    assert.equal(looksLikeDrinkName("Coca-Cola Zero", "Coca-Cola"), true);
  });

  it("detects nectar and common drink brands", () => {
    assert.equal(looksLikeDrinkName("Нектар персиковый"), true);
    assert.equal(looksLikeDrinkName("Энергетик", "Red Bull"), true);
    assert.equal(looksLikeDrinkName("Чай холодный", "Lipton"), true);
    assert.equal(looksLikeDrinkName("Тоник", "Schweppes"), true);
    assert.equal(looksLikeDrinkName("Швеппс Индиан Тоник"), true);
  });

  it("detects drinkable yogurt patterns", () => {
    assert.equal(looksLikeDrinkName("Питьевой йогурт"), true);
    assert.equal(looksLikeDrinkName("Йогурт питьевой 1.5%"), true);
    assert.equal(looksLikeDrinkName("Йогурт пить"), true);
    assert.equal(looksLikeDrinkName("Actimel клубника"), true);
    assert.equal(looksLikeDrinkName("Имунеле"), true);
  });

  it("does not treat sausage as juice", () => {
    assert.equal(looksLikeDrinkName("Сосиски"), false);
  });
});

describe("looksLikeSnackBarName", () => {
  it("detects protein and snack bars", () => {
    assert.equal(looksLikeSnackBarName("Bombbar", "Natural bar pudding"), true);
    assert.equal(looksLikeSnackBarName("Протеиновый батончик"), true);
  });

  it("does not treat a brand like Bombbar alone as a bar", () => {
    assert.equal(looksLikeSnackBarName("Bombbar"), false);
    assert.equal(looksLikeSnackBarName("Простоквашино Кефир 2.5%"), false);
  });
});
