import assert from "node:assert/strict";
import { test } from "node:test";
import {
  actionsHaveWritablePayload,
  assistantWroteFlag,
  assistantWriteMissNote,
  extractActionsJson,
  heuristicRepairWriteActions,
  needsWriteRepair,
  parsePortionGramsFromMessage,
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

test("confirm-gate: pending ActionCard is not a write miss", () => {
  const meals = { meals: [{ name: "Печень с рисом", kcal: 400 }] };
  assert.equal(
    assistantWroteFlag({
      wroteOk: false,
      actions: meals,
      userMessage: "Я съел печень с рисом 500гр",
    }),
    null,
  );
  assert.equal(
    assistantWriteMissNote({
      wroteOk: false,
      actions: meals,
      userMessage: "Я съел печень с рисом 500гр",
    }),
    "",
  );
  assert.equal(
    assistantWroteFlag({
      wroteOk: false,
      actions: null,
      userMessage: "Я съел печень с рисом 500гр",
    }),
    false,
  );
  assert.match(
    assistantWriteMissNote({
      wroteOk: false,
      actions: null,
      userMessage: "Я съел печень с рисом 500гр",
    }),
    /Не удалось/,
  );
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

test("parsePortionGramsFromMessage liters and grams", () => {
  assert.equal(parsePortionGramsFromMessage("Я выпил 3 литра светлого пива"), 3000);
  assert.equal(parsePortionGramsFromMessage("500 мл колы"), 500);
  assert.equal(parsePortionGramsFromMessage("нога индейки 300гр"), 300);
});

test("heuristicRepairWriteActions builds beer meal for liters", () => {
  const actions = heuristicRepairWriteActions("Я выпил 3 литра светлого лёгкого пива");
  assert.ok(actions?.meals?.length);
  assert.match(actions!.meals![0]!.name, /Пиво/i);
  assert.ok((actions!.meals![0]!.kcal ?? 0) >= 900);
  assert.equal(actions!.apply, true);
  assert.equal(
    needsWriteRepair("Я выпил 3 литра светлого лёгкого пива", actions),
    false,
  );
});
