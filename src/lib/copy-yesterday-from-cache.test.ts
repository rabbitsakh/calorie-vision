import assert from "node:assert/strict";
import { test } from "node:test";
import {
  cachedYesterdayMealCount,
  copyYesterdayEntriesFromCache,
  mealEntryToSaveInput,
} from "./copy-yesterday-from-cache.ts";
import { RATION_DAY_CACHE_KEY, writeRationDayCache } from "./ration-day-cache.ts";
import type { RationDayPayload } from "../components/RationDayProvider.tsx";
import type { MealEntry } from "../types/index.ts";

function mockStorage() {
  const map = new Map<string, string>();
  const storage = {
    getItem(key: string) {
      return map.has(key) ? map.get(key)! : null;
    },
    setItem(key: string, value: string) {
      map.set(key, value);
    },
    removeItem(key: string) {
      map.delete(key);
    },
  };
  Object.defineProperty(globalThis, "window", { value: globalThis, configurable: true });
  Object.defineProperty(globalThis, "localStorage", { value: storage, configurable: true });
  map.clear();
  return map;
}

function meal(partial: Partial<MealEntry> & Pick<MealEntry, "id" | "dishName" | "calories">): MealEntry {
  return {
    date: "2026-08-23",
    protein: 10,
    fat: 5,
    carbs: 20,
    fiber: 2,
    sugar: 1,
    portionGrams: 200,
    confidence: 0.9,
    imagePath: null,
    mealGroupId: null,
    mealType: "LUNCH",
    wasCorrected: false,
    originalDish: null,
    originalCalories: null,
    createdAt: "2026-08-23T12:00:00.000Z",
    ...partial,
  };
}

function payloadWithMeals(date: string, entries: MealEntry[]): RationDayPayload {
  return {
    date,
    today: date,
    meals: {
      entries,
      totalCalories: entries.reduce((s, e) => s + e.calories, 0),
      totalProtein: 0,
      totalFat: 0,
      totalCarbs: 0,
      goal: null,
      goalPace: null,
      dietLabel: null,
      sex: null,
    },
    streak: { current: 0, best: 0, freezes: 0 },
    water: { totalMl: 0, target: 2000 },
    account: {
      sex: null,
      heightCm: null,
      birthYear: null,
      fastingStartHour: null,
      fastingEndHour: null,
      timezone: null,
      waterTargetMl: null,
      fiberTargetG: null,
      sugarTargetG: null,
    },
    week: { days: [], calorieTarget: null },
    tip: null,
    diaryMood: null,
    challenges: null,
  } as RationDayPayload;
}

test("mealEntryToSaveInput maps fields onto target date", () => {
  const entry = meal({
    id: "m1",
    dishName: "Омлет",
    calories: 250,
    mealType: "BREAKFAST",
    brand: "Домик",
  });
  const body = mealEntryToSaveInput(entry, "2026-08-24");
  assert.equal(body.date, "2026-08-24");
  assert.equal(body.dishName, "Омлет");
  assert.equal(body.calories, 250);
  assert.equal(body.mealType, "BREAKFAST");
  assert.equal(body.brand, "Домик");
  assert.equal((body as { id?: string }).id, undefined);
});

test("copyYesterdayEntriesFromCache returns empty without cache", () => {
  mockStorage();
  assert.deepEqual(copyYesterdayEntriesFromCache("2026-08-24"), []);
  assert.equal(cachedYesterdayMealCount("2026-08-24"), 0);
  assert.ok(!localStorage.getItem(RATION_DAY_CACHE_KEY));
});

test("copyYesterdayEntriesFromCache copies and filters by mealType", () => {
  mockStorage();
  writeRationDayCache(
    payloadWithMeals("2026-08-23", [
      meal({ id: "a", dishName: "Каша", calories: 300, mealType: "BREAKFAST" }),
      meal({ id: "b", dishName: "Суп", calories: 200, mealType: "LUNCH" }),
      meal({ id: "c", dishName: "Яйцо", calories: 80, mealType: "BREAKFAST" }),
    ]),
  );
  const all = copyYesterdayEntriesFromCache("2026-08-24");
  assert.equal(all.length, 3);
  assert.ok(all.every((e) => e.date === "2026-08-24"));
  const breakfast = copyYesterdayEntriesFromCache("2026-08-24", "BREAKFAST");
  assert.equal(breakfast.length, 2);
  assert.deepEqual(
    breakfast.map((e) => e.dishName).sort(),
    ["Каша", "Яйцо"],
  );
  assert.equal(cachedYesterdayMealCount("2026-08-24"), 3);
  assert.equal(cachedYesterdayMealCount("2026-08-24", "BREAKFAST"), 2);
});
