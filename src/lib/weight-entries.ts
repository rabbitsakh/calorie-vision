/** Stable Prisma order: newest measurement first (tie-break by id). */
export const weightEntryOrderNewestFirst = [
  { measuredAt: "desc" as const },
  { id: "desc" as const },
];

/** Stable Prisma order: oldest measurement first (tie-break by id). */
export const weightEntryOrderOldestFirst = [
  { measuredAt: "asc" as const },
  { id: "asc" as const },
];

type SortableWeightEntry = {
  measuredAt: string | Date;
  id: string;
};

export function sortWeightEntriesNewestFirst<T extends SortableWeightEntry>(entries: T[]): T[] {
  return [...entries].sort((a, b) => compareWeightEntries(a, b));
}

export function sortWeightEntriesOldestFirst<T extends SortableWeightEntry>(entries: T[]): T[] {
  return [...entries].sort((a, b) => compareWeightEntries(b, a));
}

function compareWeightEntries(a: SortableWeightEntry, b: SortableWeightEntry): number {
  const ta = toMillis(a.measuredAt);
  const tb = toMillis(b.measuredAt);
  if (tb !== ta) {
    return tb - ta;
  }
  return b.id.localeCompare(a.id);
}

function toMillis(value: string | Date): number {
  const date = value instanceof Date ? value : new Date(value);
  return date.getTime();
}

export function groupWeightEntriesByDate<T extends SortableWeightEntry & { date: string }>(
  entries: T[],
): Array<{ date: string; items: T[] }> {
  const sorted = sortWeightEntriesNewestFirst(entries);
  return sorted.reduce<Array<{ date: string; items: T[] }>>((acc, entry) => {
    const last = acc[acc.length - 1];
    if (last?.date === entry.date) {
      last.items.push(entry);
    } else {
      acc.push({ date: entry.date, items: [entry] });
    }
    return acc;
  }, []);
}

export function computeWeightChangeKg(
  oldest: { weightKg: number; id: string } | null | undefined,
  newest: { weightKg: number; id: string } | null | undefined,
): number | null {
  if (!oldest || !newest) {
    return null;
  }
  if (oldest.id === newest.id) {
    return null;
  }
  return Math.round((newest.weightKg - oldest.weightKg) * 10) / 10;
}

/** Latest weight per calendar day (for charts / stats by date). */
export function latestWeightByDate<T extends SortableWeightEntry & { date: string; weightKg: number }>(
  entries: T[],
): Map<string, number> {
  const sorted = sortWeightEntriesOldestFirst(entries);
  const map = new Map<string, number>();
  for (const entry of sorted) {
    map.set(entry.date, entry.weightKg);
  }
  return map;
}
