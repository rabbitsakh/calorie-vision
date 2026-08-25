import assert from "node:assert/strict";
import { describe, test } from "node:test";
import type { MealEntry } from "../types/index.ts";
import type { MealListItem } from "./meal-groups.ts";
import {
  appendPendingDelete,
  buildDiaryDisplayRows,
  mealListItemKey,
  mergeEntriesAfterUndo,
  type PendingDeleteSlot,
} from "./diary-delete-slots.ts";

function meal(id: string, name: string, createdAt: string): MealEntry {
  return {
    id,
    date: "2026-08-24",
    dishName: name,
    calories: 100,
    protein: null,
    fat: null,
    carbs: null,
    fiber: null,
    sugar: null,
    portionGrams: null,
    confidence: null,
    imagePath: null,
    mealGroupId: null,
    mealType: null,
    wasCorrected: false,
    originalDish: null,
    originalCalories: null,
    createdAt,
  };
}

function single(entry: MealEntry): MealListItem {
  return { kind: "single", entry };
}

describe("diary-delete-slots", () => {
  test("mealListItemKey distinguishes singles and groups", () => {
    assert.equal(mealListItemKey(single(meal("1", "A", "2026-01-01"))), "e:1");
    assert.equal(
      mealListItemKey({
        kind: "group",
        groupId: "g1",
        entries: [meal("1", "A", "2026-01-01")],
        imagePath: null,
        totalCalories: 100,
        totalProtein: 0,
        totalFat: 0,
        totalCarbs: 0,
        totalFiber: 0,
        totalSugar: 0,
        createdAt: "2026-01-01",
      }),
      "g:g1",
    );
  });

  test("buildDiaryDisplayRows keeps undo in place of deleted meal", () => {
    const a = meal("a", "A", "2026-08-24T12:00:00Z");
    const b = meal("b", "B", "2026-08-24T11:00:00Z");
    const c = meal("c", "C", "2026-08-24T10:00:00Z");
    const items = [single(a), single(c)];
    const pending: PendingDeleteSlot[] = [
      {
        key: "undo-b",
        ids: ["b"],
        label: "B",
        snapshot: [b],
        afterKey: "e:c",
      },
    ];

    const rows = buildDiaryDisplayRows(items, pending);
    assert.deepEqual(
      rows.map((row) => (row.kind === "meal" ? mealListItemKey(row.item) : row.pending.key)),
      ["e:a", "undo-b", "e:c"],
    );
  });

  test("appendPendingDelete remaps earlier undos onto the new slot", () => {
    const first: PendingDeleteSlot = {
      key: "undo-a",
      ids: ["a"],
      label: "A",
      snapshot: [meal("a", "A", "2026-08-24T12:00:00Z")],
      afterKey: "e:b",
    };
    const second: PendingDeleteSlot = {
      key: "undo-b",
      ids: ["b"],
      label: "B",
      snapshot: [meal("b", "B", "2026-08-24T11:00:00Z")],
      afterKey: "e:c",
    };
    const next = appendPendingDelete([first], second, "e:b");
    assert.equal(next[0]?.afterKey, "undo-b");
    assert.equal(next[1]?.key, "undo-b");

    const rows = buildDiaryDisplayRows([single(meal("c", "C", "2026-08-24T10:00:00Z"))], next);
    assert.deepEqual(
      rows.map((row) => (row.kind === "meal" ? mealListItemKey(row.item) : row.pending.key)),
      ["undo-a", "undo-b", "e:c"],
    );
  });

  test("mergeEntriesAfterUndo restores without duplicates and newest-first", () => {
    const a = meal("a", "A", "2026-08-24T12:00:00Z");
    const b = meal("b", "B", "2026-08-24T11:00:00Z");
    const merged = mergeEntriesAfterUndo([a], [b, a]);
    assert.deepEqual(
      merged.map((entry) => entry.id),
      ["a", "b"],
    );
  });
});
