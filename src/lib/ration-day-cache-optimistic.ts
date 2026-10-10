/**
 * Wave S — keep ration-day localStorage in sync when offline drafts enqueue,
 * so swipe/reload still shows water / meals / weight the user just logged.
 */

import type { RationDayPayload } from "@/components/RationDayProvider";
import { buildEmptyOfflineRationDay } from "@/lib/offline-ration-day";
import {
  readRationDayCache,
  writeRationDayCache,
} from "@/lib/ration-day-cache";
import type { SaveMealInput } from "@/lib/save-meal";
import type { MealEntry, MealType } from "@/types";

export const RATION_DAY_CACHE_UPDATED_EVENT = "cv-ration-day-cache-updated";

export function notifyRationDayCacheUpdated(date: string): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent(RATION_DAY_CACHE_UPDATED_EVENT, { detail: { date } }),
  );
}

function newLocalId(prefix: string): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return `local-${prefix}-${crypto.randomUUID()}`;
  }
  return `local-${prefix}-${Date.now()}`;
}

function mealTypeValue(value: string | undefined | null): MealType | null {
  return ["BREAKFAST", "LUNCH", "DINNER", "SNACK"].includes(value ?? "")
    ? (value as MealType)
    : null;
}

function recomputeMealTotals(entries: MealEntry[]): Pick<
  RationDayPayload["meals"],
  "totalCalories" | "totalProtein" | "totalFat" | "totalCarbs" | "totalFiber" | "totalSugar"
> {
  let totalCalories = 0;
  let totalProtein = 0;
  let totalFat = 0;
  let totalCarbs = 0;
  let totalFiber = 0;
  let totalSugar = 0;
  for (const e of entries) {
    totalCalories += e.calories || 0;
    totalProtein += e.protein ?? 0;
    totalFat += e.fat ?? 0;
    totalCarbs += e.carbs ?? 0;
    totalFiber += e.fiber ?? 0;
    totalSugar += e.sugar ?? 0;
  }
  return { totalCalories, totalProtein, totalFat, totalCarbs, totalFiber, totalSugar };
}

function withWeekCalories(payload: RationDayPayload, calories: number): RationDayPayload {
  const days = payload.week?.days?.length
    ? payload.week.days.map((d) => (d.date === payload.date ? { ...d, calories } : d))
    : [{ date: payload.date, calories }];
  if (!days.some((d) => d.date === payload.date)) {
    days.push({ date: payload.date, calories });
  }
  return {
    ...payload,
    week: { ...payload.week, days },
  };
}

function ensureDay(date: string, today?: string): RationDayPayload {
  const existing = readRationDayCache(date);
  if (existing) return existing;
  return buildEmptyOfflineRationDay(date, today ?? date);
}

function commit(payload: RationDayPayload): RationDayPayload {
  writeRationDayCache(payload);
  notifyRationDayCacheUpdated(payload.date);
  return payload;
}

export function applyOptimisticWater(
  date: string,
  ml: number,
  options?: { today?: string },
): RationDayPayload | null {
  if (!date || !Number.isFinite(ml) || ml === 0) return null;
  const base = ensureDay(date, options?.today);
  const next: RationDayPayload = {
    ...base,
    water: {
      ...base.water,
      totalMl: Math.max(0, (base.water?.totalMl ?? 0) + ml),
    },
  };
  return commit(next);
}

export function applyOptimisticWeight(
  date: string,
  weightKg: number,
  options?: { today?: string },
): RationDayPayload | null {
  if (!date || !Number.isFinite(weightKg) || weightKg <= 0) return null;
  const base = ensureDay(date, options?.today);
  const next: RationDayPayload = {
    ...base,
    weightKg,
    meals: { ...base.meals, weightKg },
  };
  return commit(next);
}

function saveInputToEntry(body: SaveMealInput, date: string): MealEntry {
  const now = new Date().toISOString();
  return {
    id: newLocalId("meal"),
    date,
    dishName: body.dishName?.trim() || "Блюдо",
    calories: Math.round(body.calories) || 0,
    protein: body.protein ?? null,
    fat: body.fat ?? null,
    carbs: body.carbs ?? null,
    fiber: body.fiber ?? null,
    sugar: body.sugar ?? null,
    portionGrams: body.portionGrams ?? null,
    confidence: body.confidence ?? null,
    imagePath: body.imagePath?.trim() || null,
    mealGroupId: body.mealGroupId?.trim() || null,
    mealType: mealTypeValue(body.mealType),
    wasCorrected: body.wasCorrected ?? false,
    originalDish: body.originalDish ?? null,
    originalCalories: body.originalCalories ?? null,
    recognitionSource: body.recognitionSource ?? null,
    photoKind: body.photoKind ?? null,
    barcode: body.barcode ?? null,
    brand: body.brand ?? null,
    lookupMode: body.lookupMode ?? null,
    eatenAt: body.eatenAt ?? now,
    createdAt: now,
  };
}

export function applyOptimisticMeals(
  date: string,
  body: SaveMealInput | { entries: SaveMealInput[] },
  options?: { today?: string },
): RationDayPayload | null {
  if (!date) return null;
  const inputs = "entries" in body ? body.entries : [body];
  if (!inputs.length) return null;
  const base = ensureDay(date, options?.today);
  const added = inputs
    .filter((item) => item?.dishName && Number.isFinite(item.calories))
    .map((item) => saveInputToEntry({ ...item, date }, date));
  if (added.length === 0) return null;
  const entries = [...(base.meals?.entries ?? []), ...added];
  const totals = recomputeMealTotals(entries);
  const next = withWeekCalories(
    {
      ...base,
      meals: { ...base.meals, entries, ...totals },
      streak: {
        ...base.streak,
        loggedToday: true,
      },
    },
    totals.totalCalories,
  );
  return commit(next);
}

export function applyOptimisticMealPatch(
  date: string,
  mealId: string,
  patch: Record<string, unknown>,
  options?: { today?: string },
): RationDayPayload | null {
  if (!date || !mealId) return null;
  const base = ensureDay(date, options?.today);
  const entries = (base.meals?.entries ?? []).map((entry) => {
    if (entry.id !== mealId) return entry;
    const next: MealEntry = { ...entry };
    if (typeof patch.dishName === "string") next.dishName = patch.dishName;
    if (typeof patch.calories === "number") next.calories = Math.round(patch.calories);
    if ("protein" in patch) next.protein = (patch.protein as number | null) ?? null;
    if ("fat" in patch) next.fat = (patch.fat as number | null) ?? null;
    if ("carbs" in patch) next.carbs = (patch.carbs as number | null) ?? null;
    if ("fiber" in patch) next.fiber = (patch.fiber as number | null) ?? null;
    if ("sugar" in patch) next.sugar = (patch.sugar as number | null) ?? null;
    if ("portionGrams" in patch) {
      next.portionGrams = (patch.portionGrams as number | null) ?? null;
    }
    if ("mealType" in patch) {
      next.mealType = mealTypeValue(patch.mealType as string | null);
    }
    if ("eatenAt" in patch && typeof patch.eatenAt === "string") {
      next.eatenAt = patch.eatenAt;
    }
    if ("brand" in patch) next.brand = (patch.brand as string | null) ?? null;
    if ("lookupMode" in patch) {
      next.lookupMode = (patch.lookupMode as string | null) ?? null;
    }
    return next;
  });
  if (!(base.meals?.entries ?? []).some((e) => e.id === mealId)) return null;
  const totals = recomputeMealTotals(entries);
  const next = withWeekCalories(
    {
      ...base,
      meals: { ...base.meals, entries, ...totals },
    },
    totals.totalCalories,
  );
  return commit(next);
}

export function applyOptimisticMealDelete(
  date: string,
  mealId: string,
  options?: { today?: string },
): RationDayPayload | null {
  if (!date || !mealId) return null;
  const base = ensureDay(date, options?.today);
  const before = base.meals?.entries ?? [];
  if (!before.some((e) => e.id === mealId)) return null;
  const entries = before.filter((e) => e.id !== mealId);
  const totals = recomputeMealTotals(entries);
  const next = withWeekCalories(
    {
      ...base,
      meals: { ...base.meals, entries, ...totals },
    },
    totals.totalCalories,
  );
  return commit(next);
}
