import type { DayMealsResponse, MealEntry } from "@/types";
import type { MealListItem } from "@/lib/meal-groups";

export type PendingDeleteSlot = {
  key: string;
  ids: string[];
  label: string;
  snapshot: MealEntry[];
  /** Place undo before this meal/undo key; null = end of list. */
  afterKey: string | null;
};

export type DiaryDisplayRow =
  | { kind: "meal"; item: MealListItem }
  | { kind: "undo"; pending: PendingDeleteSlot };

export function mealListItemKey(item: MealListItem): string {
  return item.kind === "group" ? `g:${item.groupId}` : `e:${item.entry.id}`;
}

export function findMealListIndex(items: MealListItem[], ids: string[]): number {
  const idSet = new Set(ids);
  return items.findIndex((item) => {
    if (item.kind === "single") return idSet.has(item.entry.id);
    return item.entries.some((entry) => idSet.has(entry.id));
  });
}

/** Remap undos that pointed at a removed meal so they sit above the new undo slot. */
export function appendPendingDelete(
  prev: PendingDeleteSlot[],
  slot: PendingDeleteSlot,
  removedMealKey: string,
): PendingDeleteSlot[] {
  return [
    ...prev.map((item) =>
      item.afterKey === removedMealKey ? { ...item, afterKey: slot.key } : item,
    ),
    slot,
  ];
}

export function buildDiaryDisplayRows(
  listItems: MealListItem[],
  pendingDeletes: PendingDeleteSlot[],
): DiaryDisplayRow[] {
  const rows: DiaryDisplayRow[] = [];
  const placed = new Set<string>();

  function flushBefore(targetKey: string | null) {
    let grew = true;
    while (grew) {
      grew = false;
      for (const slot of pendingDeletes) {
        if (placed.has(slot.key)) continue;
        if (slot.afterKey !== targetKey) continue;
        flushBefore(slot.key);
        rows.push({ kind: "undo", pending: slot });
        placed.add(slot.key);
        grew = true;
      }
    }
  }

  for (const item of listItems) {
    const key = mealListItemKey(item);
    flushBefore(key);
    rows.push({ kind: "meal", item });
  }

  flushBefore(null);

  for (const slot of pendingDeletes) {
    if (placed.has(slot.key)) continue;
    flushBefore(slot.key);
    rows.push({ kind: "undo", pending: slot });
    placed.add(slot.key);
  }

  return rows;
}

export function mergeEntriesAfterUndo(
  current: MealEntry[],
  snapshot: MealEntry[],
): MealEntry[] {
  const existing = new Set(current.map((entry) => entry.id));
  const restored = snapshot.filter((entry) => !existing.has(entry.id));
  return [...current, ...restored].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );
}

/** Hide optimistically deleted meals when provider data still includes them. */
export function filterMealsResponse(
  data: DayMealsResponse,
  excludeIds: ReadonlySet<string>,
): DayMealsResponse {
  if (excludeIds.size === 0) {
    return data;
  }

  const excluded = data.entries.filter((entry) => excludeIds.has(entry.id));
  if (excluded.length === 0) {
    return data;
  }

  const entries = data.entries.filter((entry) => !excludeIds.has(entry.id));
  const totals = subtractMealTotals(
    {
      calories: data.totalCalories,
      protein: data.totalProtein ?? 0,
      fat: data.totalFat ?? 0,
      carbs: data.totalCarbs ?? 0,
      fiber: data.totalFiber ?? 0,
      sugar: data.totalSugar ?? 0,
    },
    excluded,
  );

  return {
    ...data,
    entries,
    totalCalories: totals.calories,
    totalProtein: totals.protein,
    totalFat: totals.fat,
    totalCarbs: totals.carbs,
    totalFiber: totals.fiber,
    totalSugar: totals.sugar,
  };
}

export function subtractMealTotals(
  totals: { calories: number; protein: number; fat: number; carbs: number; fiber: number; sugar: number },
  snapshot: MealEntry[],
) {
  return {
    calories: Math.max(0, totals.calories - snapshot.reduce((sum, e) => sum + e.calories, 0)),
    protein: Math.max(0, Math.round((totals.protein - snapshot.reduce((sum, e) => sum + (e.protein ?? 0), 0)) * 10) / 10),
    fat: Math.max(0, Math.round((totals.fat - snapshot.reduce((sum, e) => sum + (e.fat ?? 0), 0)) * 10) / 10),
    carbs: Math.max(0, Math.round((totals.carbs - snapshot.reduce((sum, e) => sum + (e.carbs ?? 0), 0)) * 10) / 10),
    fiber: Math.max(0, Math.round((totals.fiber - snapshot.reduce((sum, e) => sum + (e.fiber ?? 0), 0)) * 10) / 10),
    sugar: Math.max(0, Math.round((totals.sugar - snapshot.reduce((sum, e) => sum + (e.sugar ?? 0), 0)) * 10) / 10),
  };
}

export function addMealTotals(
  totals: { calories: number; protein: number; fat: number; carbs: number; fiber: number; sugar: number },
  snapshot: MealEntry[],
) {
  return {
    calories: totals.calories + snapshot.reduce((sum, e) => sum + e.calories, 0),
    protein: Math.round((totals.protein + snapshot.reduce((sum, e) => sum + (e.protein ?? 0), 0)) * 10) / 10,
    fat: Math.round((totals.fat + snapshot.reduce((sum, e) => sum + (e.fat ?? 0), 0)) * 10) / 10,
    carbs: Math.round((totals.carbs + snapshot.reduce((sum, e) => sum + (e.carbs ?? 0), 0)) * 10) / 10,
    fiber: Math.round((totals.fiber + snapshot.reduce((sum, e) => sum + (e.fiber ?? 0), 0)) * 10) / 10,
    sugar: Math.round((totals.sugar + snapshot.reduce((sum, e) => sum + (e.sugar ?? 0), 0)) * 10) / 10,
  };
}
