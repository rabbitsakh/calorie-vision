import assert from "node:assert/strict";
import { test } from "node:test";
import {
  buildRoutinePayloadFromActions,
  exercisesFromWorkoutDay,
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

test("mealsPayloadFromActions maps kcal and macros", () => {
  const meals = mealsPayloadFromActions(
    {
      meals: [{ name: "Омлет", kcal: 320, protein: 24, fat: 22, carbs: 4, note: "завтрак" }],
    },
    "2026-10-10",
  );
  assert.equal(meals[0]?.dishName, "Омлет");
  assert.equal(meals[0]?.calories, 320);
  assert.equal(meals[0]?.protein, 24);
  assert.equal(meals[0]?.fat, 22);
  assert.equal(meals[0]?.carbs, 4);
  assert.equal(meals[0]?.recognitionSource, "assistant");
  assert.equal(meals[0]?.eatenAt, undefined);
});

test("exercisesFromWorkoutDay never emits упражнение N", () => {
  const exs = exercisesFromWorkoutDay({ focus: "Грудь" });
  assert.ok(exs.length >= 3);
  for (const ex of exs) {
    assert.doesNotMatch(ex.name, /упражнение\s*\d/i);
  }
  assert.ok(exs.some((e) => /жим/i.test(e.name)));
});

test("exercisesFromWorkoutDay prefers notes when present", () => {
  const exs = exercisesFromWorkoutDay({
    focus: "Грудь",
    notes: "Жим гантелей, Кроссовер",
  });
  assert.equal(exs.length, 2);
  assert.equal(exs[0]?.name, "Жим гантелей");
});

test("mealsPayloadFromActions maps meals.time to eatenAt", () => {
  const meals = mealsPayloadFromActions(
    {
      meals: [
        {
          name: "Протеин изолят",
          kcal: 260,
          protein: 60,
          fat: 1,
          carbs: 2,
          note: "перекус",
          time: "10:30",
        },
      ],
    },
    "2026-10-21",
    "Europe/Moscow",
  );
  assert.ok(meals[0]?.eatenAt);
  // 10:30 MSK = 07:30 UTC
  assert.equal(meals[0]?.eatenAt, "2026-10-21T07:30:00.000Z");
});
