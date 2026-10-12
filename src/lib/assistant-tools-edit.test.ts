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
});
