import assert from "node:assert/strict";
import { test } from "node:test";
import { mealsPayloadFromActions } from "./assistant-apply.ts";
import { foodConfirmFromPhotoDraft, prepareFoodConfirmSave } from "./food-confirm.ts";
import {
  caloriesFromField,
  knownCalories,
  macroFromField,
  photoConfirmCaloriesError,
  recognitionCalorieLabel,
} from "./known-calories.ts";
import { decideUploadAccess } from "./upload.ts";

test("калории: ноль остаётся нулём, неизвестное не становится 200", () => {
  const cases: Array<{ value: unknown; calories: number | null; label: string }> = [
    { value: 0, calories: 0, label: "калории не определены" },
    { value: 259, calories: 259, label: "259 ккал" },
    { value: 12.6, calories: 13, label: "13 ккал" },
    { value: undefined, calories: null, label: "калории не определены" },
    { value: Number.NaN, calories: null, label: "калории не определены" },
    { value: -5, calories: null, label: "калории не определены" },
  ];
  for (const row of cases) {
    const calories = knownCalories(row.value);
    assert.equal(calories, row.calories, String(row.value));
    assert.notEqual(calories, 200);
    assert.equal(recognitionCalorieLabel(calories), row.label);
  }
});

test("поля карточки: пусто неизвестно, «0» сохраняется", () => {
  const fields: Array<{ raw: string; calories: number | null; macro: number | null; error: boolean }> = [
    { raw: "", calories: null, macro: null, error: true },
    { raw: "   ", calories: null, macro: null, error: true },
    { raw: "0", calories: 0, macro: 0, error: false },
    { raw: "0,7", calories: 1, macro: 0.7, error: false },
    { raw: "70", calories: 70, macro: 70, error: false },
    { raw: "-1", calories: null, macro: null, error: true },
  ];
  for (const row of fields) {
    assert.equal(caloriesFromField(row.raw), row.calories, row.raw);
    assert.equal(macroFromField(row.raw), row.macro, row.raw);
    assert.equal(photoConfirmCaloriesError(row.raw) == null, !row.error, row.raw);
  }
});

test("фоточерновик с 0 ккал не подставляет 200 и не сохраняется молча", () => {
  const dish = foodConfirmFromPhotoDraft({
    dishName: "Кола без сахара",
    calories: 0,
    protein: 0,
    fat: 0,
    carbs: 0,
    portionGrams: 330,
  });
  assert.equal(dish.kcal, null);
  assert.equal(dish.protein, 0);
  assert.notEqual(dish.kcal, 200);
  const blocked = prepareFoodConfirmSave([dish]);
  assert.equal(blocked.ok, false);
});

test("сохранение чата не выдумывает 200 ккал, если числа нет", () => {
  const meals = mealsPayloadFromActions(
    {
      meals: [
        { name: "Вода", kcal: 0, protein: 0, fat: 0, carbs: 0 },
        { name: "Без цифр" },
      ],
    },
    "2026-11-06",
  );
  assert.equal(meals.length, 1);
  assert.equal(meals[0]?.dishName.startsWith("Вода"), true);
  assert.equal(meals[0]?.calories, 0);
  assert.equal(meals[0]?.protein, 0);
});

test("доступ к фото: чужой sidecar не открывается своей записью", () => {
  const cases: Array<{
    ownerUserId: string | null;
    requesterUserId: string;
    isAdmin?: boolean;
    referencedByRequester: boolean;
    allowed: boolean;
  }> = [
    { ownerUserId: "alice", requesterUserId: "alice", referencedByRequester: false, allowed: true },
    { ownerUserId: "alice", requesterUserId: "bob", referencedByRequester: true, allowed: false },
    { ownerUserId: "alice", requesterUserId: "bob", referencedByRequester: false, allowed: false },
    { ownerUserId: null, requesterUserId: "bob", referencedByRequester: true, allowed: true },
    { ownerUserId: null, requesterUserId: "bob", referencedByRequester: false, allowed: false },
    { ownerUserId: "alice", requesterUserId: "bob", isAdmin: true, referencedByRequester: false, allowed: true },
    { ownerUserId: null, requesterUserId: "", referencedByRequester: true, allowed: false },
  ];
  for (const row of cases) {
    assert.equal(
      decideUploadAccess(row),
      row.allowed,
      `${row.ownerUserId ?? "none"}→${row.requesterUserId || "empty"}`,
    );
  }
});
