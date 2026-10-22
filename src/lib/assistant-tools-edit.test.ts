import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { normalizeAssistantActions } from "./admin-assistant.ts";
import { shouldAutoApply } from "./assistant-tools.ts";
import { userWantsWrite } from "./assistant-intent.ts";

describe("Wave I assistant edit intents", () => {
  it("detects delete/fix write intent", () => {
    assert.equal(userWantsWrite("удали ужин"), true);
    assert.equal(userWantsWrite("исправь белок у омлета"), true);
  });

  it("normalizes deleteMeals and patchMeals", () => {
    const actions = normalizeAssistantActions({
      apply: true,
      deleteMeals: [{ match: "Омлет" }],
      patchMeals: [{ match: "суп", protein: 12, kcal: 220 }],
    });
    assert.ok(actions);
    assert.deepEqual(actions!.deleteMeals, [{ match: "Омлет" }]);
    assert.equal(actions!.patchMeals?.[0]?.match, "суп");
    assert.equal(actions!.patchMeals?.[0]?.protein, 12);
    assert.equal(shouldAutoApply(actions, "удали омлет"), true);
  });

  it("normalizes patchMeals.time for eatenAt updates", () => {
    const actions = normalizeAssistantActions({
      apply: true,
      targetDate: "сегодня",
      patchMeals: [
        { match: "Печенье", time: "6:30" },
        { match: "Оладьи", time: "06:30" },
      ],
    });
    assert.equal(actions!.patchMeals?.[0]?.time, "6:30");
    assert.equal(actions!.patchMeals?.[1]?.time, "06:30");
  });

  it("normalizes slot mealType on delete/patch", () => {
    const del = normalizeAssistantActions({
      apply: true,
      deleteMeals: [{ match: "ужин" }],
    });
    assert.equal(del!.deleteMeals?.[0]?.mealType, "DINNER");

    const patch = normalizeAssistantActions({
      apply: true,
      patchMeals: [{ mealType: "BREAKFAST", time: "06:30" }],
    });
    assert.equal(patch!.patchMeals?.[0]?.match, "завтрак");
    assert.equal(patch!.patchMeals?.[0]?.mealType, "BREAKFAST");
    assert.equal(patch!.patchMeals?.[0]?.time, "06:30");
  });

  it("detects portion and slot-move write intent", () => {
    assert.equal(userWantsWrite("сделай омлет 200 г"), true);
    assert.equal(userWantsWrite("перенеси обед в ужин"), true);
  });

  it("normalizes toMealType and portionGrams on patch", () => {
    const actions = normalizeAssistantActions({
      apply: true,
      patchMeals: [
        { match: "обед", toMealType: "DINNER" },
        { match: "омлет", portionGrams: 200 },
      ],
    });
    assert.equal(actions!.patchMeals?.[0]?.mealType, "LUNCH");
    assert.equal(actions!.patchMeals?.[0]?.toMealType, "DINNER");
    assert.equal(actions!.patchMeals?.[1]?.portionGrams, 200);
  });
});
