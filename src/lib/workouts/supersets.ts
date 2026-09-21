/** Normalize superset/circuit label: A–Z or empty → null. */
export function parseSupersetGroup(raw: unknown): string | null | undefined {
  if (raw === undefined) return undefined;
  if (raw === null || raw === "") return null;
  if (typeof raw !== "string") return null;
  const trimmed = raw.trim().toUpperCase().slice(0, 8);
  if (!trimmed) return null;
  if (!/^[A-Z0-9]+$/.test(trimmed)) return null;
  return trimmed;
}

export type SupersetItem = {
  id: string;
  sortOrder: number;
  supersetGroup?: string | null;
};

/**
 * Group exercises for live UI: contiguous same-letter groups stay together.
 * Solo exercises are single-item groups with group=null.
 */
export function groupBySuperset<T extends SupersetItem>(items: readonly T[]): Array<{
  group: string | null;
  items: T[];
}> {
  const sorted = [...items].sort(
    (a, b) => a.sortOrder - b.sortOrder || a.id.localeCompare(b.id),
  );
  const out: Array<{ group: string | null; items: T[] }> = [];
  for (const item of sorted) {
    const g = item.supersetGroup?.trim() ? item.supersetGroup.trim().toUpperCase() : null;
    const last = out[out.length - 1];
    if (g && last && last.group === g) {
      last.items.push(item);
    } else {
      out.push({ group: g, items: [item] });
    }
  }
  return out;
}

/** Next free letter A..Z not used in the list. */
export function nextSupersetLetter(existing: readonly (string | null | undefined)[]): string {
  const used = new Set(
    existing
      .map((g) => g?.trim().toUpperCase())
      .filter((g): g is string => Boolean(g)),
  );
  for (let i = 0; i < 26; i++) {
    const letter = String.fromCharCode(65 + i);
    if (!used.has(letter)) return letter;
  }
  return "Z";
}
