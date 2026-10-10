import assert from "node:assert/strict";
import { test } from "node:test";
import {
  buildRoutinePayloadFromActions,
  mealsPayloadFromActions,
  muscleGroupsFromFocus,
} from "./assistant-apply.ts";

test("muscleGroupsFromFocus maps Russian labels", () => {
  assert.deepEqual(muscleGroupsFromFocus("Грудь/трицепс"), ["chest", "triceps"]);
  assert.ok(muscleGroupsFromFocus("Непонятно").includes("other"));
});

test("buildRoutinePayloadFromActions builds exercises", () => {
  const payload = buildRoutinePayloadFromActions({
    summary: "3 дня",
    workoutDays: [
      { day: "Пн", focus: "Грудь", notes: "Жим лёжа, Разводки" },
      { day: "Ср", focus: "Спина", notes: "Тяга" },
    ],
  });
  assert.ok(payload);
  assert.match(payload!.name, /Пн/);
  assert.ok(payload!.exercises.some((e) => /Жим/.test(e.name)));
  assert.ok(payload!.muscleGroups.includes("chest"));
});

test("mealsPayloadFromActions maps kcal", () => {
  const meals = mealsPayloadFromActions(
    { meals: [{ name: "Омлет", kcal: 320, note: "завтрак" }] },
    "2026-10-10",
  );
  assert.equal(meals[0]?.dishName, "Омлет");
  assert.equal(meals[0]?.calories, 320);
  assert.equal(meals[0]?.recognitionSource, "assistant");
});
