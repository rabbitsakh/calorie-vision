import type { MealEntry } from "@/types";

export type MealListSingle = {
  kind: "single";
  entry: MealEntry;
};

export type MealListGroup = {
  kind: "group";
  groupId: string;
  entries: MealEntry[];
  imagePath: string | null;
  totalCalories: number;
  totalProtein: number;
  totalFat: number;
  totalCarbs: number;
  totalFiber: number;
  totalSugar: number;
  createdAt: string;
};

export type MealListItem = MealListSingle | MealListGroup;

function sumOptional(values: Array<number | null | undefined>): number {
  return values.reduce<number>((sum, value) => sum + (value ?? 0), 0);
}

export function groupMealEntries(entries: MealEntry[]): MealListItem[] {
  const byGroupId = new Map<string, MealEntry[]>();

  for (const entry of entries) {
    if (!entry.mealGroupId) {
      continue;
    }

    const group = byGroupId.get(entry.mealGroupId) ?? [];
    group.push(entry);
    byGroupId.set(entry.mealGroupId, group);
  }

  const multiGroupIds = new Set(
    [...byGroupId.entries()].filter(([, groupEntries]) => groupEntries.length >= 2).map(([id]) => id),
  );

  const rendered: MealListItem[] = [];
  const seenGroupIds = new Set<string>();

  for (const entry of entries) {
    const groupId = entry.mealGroupId;

    if (groupId && multiGroupIds.has(groupId)) {
      if (seenGroupIds.has(groupId)) {
        continue;
      }

      seenGroupIds.add(groupId);
      const groupEntries = [...(byGroupId.get(groupId) ?? [])].sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      );
      const imagePath = groupEntries.find((item) => item.imagePath)?.imagePath ?? null;

      rendered.push({
        kind: "group",
        groupId,
        entries: groupEntries,
        imagePath,
        totalCalories: groupEntries.reduce((sum, item) => sum + item.calories, 0),
        totalProtein: sumOptional(groupEntries.map((item) => item.protein)),
        totalFat: sumOptional(groupEntries.map((item) => item.fat)),
        totalCarbs: sumOptional(groupEntries.map((item) => item.carbs)),
        totalFiber: sumOptional(groupEntries.map((item) => item.fiber)),
        totalSugar: sumOptional(groupEntries.map((item) => item.sugar)),
        createdAt: groupEntries[0]?.createdAt ?? entry.createdAt,
      });
      continue;
    }

    rendered.push({ kind: "single", entry });
  }

  return rendered;
}
