/** Stable Prisma order: newest calendar day first, then time of measurement. */
export const weightEntryOrderNewestFirst = [
  { date: "desc" as const },
  { measuredAt: "desc" as const },
  { id: "desc" as const },
];

/** Stable Prisma order: oldest calendar day first, then time of measurement. */
export const weightEntryOrderOldestFirst = [
  { date: "asc" as const },
  { measuredAt: "asc" as const },
  { id: "asc" as const },
];

type SortableWeightEntry = {
  date?: string;
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
  if (a.date && b.date && a.date !== b.date) {
    return b.date.localeCompare(a.date);
  }

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

/** Median weight per calendar day (for charts / stats by date). */
export function medianWeightByDate<T extends SortableWeightEntry & { date: string; weightKg: number }>(
  entries: T[],
): Map<string, number> {
  const grouped = groupWeightEntriesByDate(entries);
  const map = new Map<string, number>();
  for (const { date, items } of grouped) {
    const weights = items.map((item) => item.weightKg).sort((a, b) => a - b);
    const mid = Math.floor(weights.length / 2);
    const median =
      weights.length % 2 === 0
        ? (weights[mid - 1]! + weights[mid]!) / 2
        : weights[mid]!;
    map.set(date, Math.round(median * 10) / 10);
  }
  return map;
}

/** Latest weight per calendar day (kept for callers that need the last measurement). */
export function latestWeightByDate<T extends SortableWeightEntry & { date: string; weightKg: number }>(
  entries: T[],
): Map<string, number> {
  const sorted = sortWeightEntriesNewestFirst(entries);
  const map = new Map<string, number>();
  for (const entry of sorted) {
    if (!map.has(entry.date)) {
      map.set(entry.date, entry.weightKg);
    }
  }
  return map;
}
