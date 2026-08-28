import assert from "node:assert/strict";
import { test } from "node:test";
import { groupMealEntries } from "./meal-groups.ts";
import type { MealEntry } from "@/types";

function entry(partial: Partial<MealEntry> & Pick<MealEntry, "id" | "dishName" | "calories">): MealEntry {
  return {
    date: "2026-08-19",
    protein: null,
    fat: null,
    carbs: null,
    portionGrams: null,
    confidence: null,
    imagePath: null,
    mealGroupId: null,
    wasCorrected: false,
    originalDish: null,
    originalCalories: null,
    createdAt: "2026-08-19T12:00:00.000Z",
    ...partial,
  };
}

test("keeps standalone entries as singles", () => {
  const items = groupMealEntries([
    entry({ id: "1", dishName: "Суп", calories: 200 }),
    entry({ id: "2", dishName: "Салат", calories: 150 }),
  ]);

  assert.equal(items.length, 2);
  assert.equal(items.every((item) => item.kind === "single"), true);
});

test("groups entries with the same mealGroupId", () => {
  const items = groupMealEntries([
    entry({
      id: "2",
      dishName: "Котлета",
      calories: 250,
      mealGroupId: "g1",
      createdAt: "2026-08-19T12:01:00.000Z",
    }),
    entry({
      id: "1",
      dishName: "Гречка",
      calories: 180,
      mealGroupId: "g1",
      imagePath: "/uploads/plate.jpg",
      createdAt: "2026-08-19T12:00:00.000Z",
      eatenAt: "2026-08-19T14:30:00.000Z",
    }),
  ]);

  assert.equal(items.length, 1);
  assert.equal(items[0]?.kind, "group");
  if (items[0]?.kind === "group") {
    assert.equal(items[0].entries.length, 2);
    assert.equal(items[0].totalCalories, 430);
    assert.equal(items[0].imagePath, "/uploads/plate.jpg");
    assert.equal(items[0].entries[0]?.dishName, "Гречка");
    assert.equal(items[0].createdAt, "2026-08-19T14:30:00.000Z");
  }
});

test("does not group a lone entry with mealGroupId", () => {
  const items = groupMealEntries([
    entry({ id: "1", dishName: "Одиночное", calories: 100, mealGroupId: "g1" }),
  ]);

  assert.equal(items.length, 1);
  assert.equal(items[0]?.kind, "single");
});
