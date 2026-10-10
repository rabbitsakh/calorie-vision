import assert from "node:assert/strict";
import { test } from "node:test";
import {
  applyOptimisticMealDelete,
  applyOptimisticMealPatch,
  applyOptimisticMeals,
  applyOptimisticWater,
  applyOptimisticWeight,
  RATION_DAY_CACHE_UPDATED_EVENT,
} from "./ration-day-cache-optimistic.ts";
import { readRationDayCache, writeRationDayCache } from "./ration-day-cache.ts";
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
  const listeners = new Map<string, Set<EventListener>>();
  Object.defineProperty(globalThis, "window", {
    value: {
      addEventListener(type: string, listener: EventListener) {
        if (!listeners.has(type)) listeners.set(type, new Set());
        listeners.get(type)!.add(listener);
      },
      removeEventListener(type: string, listener: EventListener) {
        listeners.get(type)?.delete(listener);
      },
      dispatchEvent(event: Event) {
        for (const listener of listeners.get(event.type) ?? []) {
          listener(event);
        }
        return true;
      },
      localStorage: storage,
    },
    configurable: true,
  });
  Object.defineProperty(globalThis, "localStorage", { value: storage, configurable: true });
  map.clear();
  return map;
}

function meal(partial: Partial<MealEntry> & Pick<MealEntry, "id" | "dishName" | "calories">): MealEntry {
  return {
    date: "2026-08-24",
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
    createdAt: "2026-08-24T12:00:00.000Z",
    ...partial,
  };
}

function seed(date: string, entries: MealEntry[] = [], waterMl = 0): RationDayPayload {
  const payload = {
    date,
    today: date,
    meals: {
      entries,
      totalCalories: entries.reduce((s, e) => s + e.calories, 0),
      totalProtein: 0,
      totalFat: 0,
      totalCarbs: 0,
      totalFiber: 0,
      totalSugar: 0,
      goal: null,
      goalPace: null,
      dietLabel: null,
      sex: null,
      weightKg: null,
      target: null,
      comparison: null,
      calorieTone: null,
    },
    streak: {
      streak: 1,
      longestStreak: 1,
      nextMilestone: 3,
      daysUntilNext: 2,
      last14: [],
      daysLoggedTotal: 1,
      loggedToday: entries.length > 0,
      streakAtRisk: false,
      streakBeforeToday: 0,
      freezeAvailable: false,
      canFreezeYesterday: false,
      frozenDates: [],
      weekStart: date,
      daysLoggedThisWeek: 1,
      daysInWeekSoFar: 1,
      weekNudge: null,
    },
    water: { totalMl: waterMl, target: 2000 },
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
    week: { days: [{ date, calories: entries.reduce((s, e) => s + e.calories, 0) }], calorieTarget: null },
    weightKg: null,
    tip: null,
    diaryMood: null,
    challenges: { active: null },
  } as RationDayPayload;
  writeRationDayCache(payload);
  return payload;
}

test("applyOptimisticWater increments and notifies", () => {
  mockStorage();
  seed("2026-08-24", [], 250);
  let events = 0;
  window.addEventListener(RATION_DAY_CACHE_UPDATED_EVENT, () => {
    events += 1;
  });
  const next = applyOptimisticWater("2026-08-24", 200);
  assert.equal(next?.water.totalMl, 450);
  assert.equal(readRationDayCache("2026-08-24")?.water.totalMl, 450);
  assert.equal(events, 1);
});

test("applyOptimisticWater seeds empty day when cache missing", () => {
  mockStorage();
  const next = applyOptimisticWater("2026-08-24", 300);
  assert.equal(next?.water.totalMl, 300);
  assert.equal(readRationDayCache("2026-08-24")?.water.totalMl, 300);
});

test("applyOptimisticWeight sets weightKg", () => {
  mockStorage();
  seed("2026-08-24");
  applyOptimisticWeight("2026-08-24", 72.4);
  const hit = readRationDayCache("2026-08-24");
  assert.equal(hit?.weightKg, 72.4);
  assert.equal(hit?.meals.weightKg, 72.4);
});

test("applyOptimisticMeals appends entries and totals", () => {
  mockStorage();
  seed("2026-08-24", [meal({ id: "m1", dishName: "Суп", calories: 200 })]);
  applyOptimisticMeals("2026-08-24", {
    date: "2026-08-24",
    dishName: "Каша",
    calories: 300,
    protein: 12,
  });
  const hit = readRationDayCache("2026-08-24");
  assert.equal(hit?.meals.entries.length, 2);
  assert.equal(hit?.meals.totalCalories, 500);
  assert.equal(hit?.week.days.find((d) => d.date === "2026-08-24")?.calories, 500);
  assert.equal(hit?.streak.loggedToday, true);
});

test("applyOptimisticMealPatch and delete", () => {
  mockStorage();
  seed("2026-08-24", [
    meal({ id: "m1", dishName: "Суп", calories: 200, mealType: "LUNCH" }),
    meal({ id: "m2", dishName: "Чай", calories: 50, mealType: "SNACK" }),
  ]);
  applyOptimisticMealPatch("2026-08-24", "m1", { calories: 250, mealType: "DINNER" });
  let hit = readRationDayCache("2026-08-24");
  assert.equal(hit?.meals.entries.find((e) => e.id === "m1")?.calories, 250);
  assert.equal(hit?.meals.entries.find((e) => e.id === "m1")?.mealType, "DINNER");
  assert.equal(hit?.meals.totalCalories, 300);

  applyOptimisticMealDelete("2026-08-24", "m2");
  hit = readRationDayCache("2026-08-24");
  assert.equal(hit?.meals.entries.length, 1);
  assert.equal(hit?.meals.totalCalories, 250);
});
