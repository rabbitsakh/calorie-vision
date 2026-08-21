import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { looksLikeDrinkName } from "./portion-unit.ts";

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
  });

  it("does not treat sausage as juice", () => {
    assert.equal(looksLikeDrinkName("Сосиски"), false);
  });
});
