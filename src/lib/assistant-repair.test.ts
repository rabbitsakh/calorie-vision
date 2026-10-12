import assert from "node:assert/strict";
import { test } from "node:test";
import {
  actionsHaveWritablePayload,
  extractActionsJson,
  needsWriteRepair,
} from "./assistant-repair.ts";

test("needsWriteRepair when user asked to add but no meals", () => {
  assert.equal(
    needsWriteRepair("добавь булочку в рацион", null),
    true,
  );
  assert.equal(
    needsWriteRepair("добавь булочку", { meals: [{ name: "Булочка", kcal: 300 }] }),
    false,
  );
  assert.equal(needsWriteRepair("что поесть?", null), false);
});

test("extractActionsJson from fence and raw object", () => {
  const fenced = extractActionsJson(
    'Ок\n```cv-actions\n{"apply":true,"meals":[{"name":"Суп","kcal":200}]}\n```',
  );
  assert.equal(fenced?.meals?.[0]?.name, "Суп");

  const raw = extractActionsJson(
    'Готово {"apply":true,"meals":[{"name":"Каша","kcal":250}]}',
  );
  assert.equal(raw?.meals?.[0]?.name, "Каша");
  assert.equal(actionsHaveWritablePayload(raw), true);
});

test("extractActionsJson ignores empty apply false", () => {
  assert.equal(extractActionsJson('{"apply":false}'), null);
});
