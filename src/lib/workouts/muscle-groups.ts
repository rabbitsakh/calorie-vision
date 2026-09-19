export const MUSCLE_GROUP_KEYS = [
  "chest",
  "back",
  "legs",
  "shoulders",
  "biceps",
  "triceps",
  "abs",
  "other",
] as const;

export type MuscleGroupKey = (typeof MUSCLE_GROUP_KEYS)[number];

export const MUSCLE_GROUPS: ReadonlyArray<{ key: MuscleGroupKey; label: string }> = [
  { key: "chest", label: "Грудь" },
  { key: "back", label: "Спина" },
  { key: "legs", label: "Ноги" },
  { key: "shoulders", label: "Плечи" },
  { key: "biceps", label: "Бицепс" },
  { key: "triceps", label: "Трицепс" },
  { key: "abs", label: "Пресс" },
  { key: "other", label: "Другое" },
];

const LABEL_BY_KEY = Object.fromEntries(MUSCLE_GROUPS.map((g) => [g.key, g.label])) as Record<
  MuscleGroupKey,
  string
>;

export function isMuscleGroupKey(value: string): value is MuscleGroupKey {
  return (MUSCLE_GROUP_KEYS as readonly string[]).includes(value);
}

export function muscleGroupLabel(key: string): string {
  if (isMuscleGroupKey(key)) {
    return LABEL_BY_KEY[key];
  }
  return key;
}

export function parseMuscleGroupKeys(raw: unknown): MuscleGroupKey[] | null {
  if (!Array.isArray(raw) || raw.length === 0) {
    return null;
  }
  const out: MuscleGroupKey[] = [];
  const seen = new Set<string>();
  for (const item of raw) {
    if (typeof item !== "string" || !isMuscleGroupKey(item) || seen.has(item)) {
      continue;
    }
    seen.add(item);
    out.push(item);
  }
  return out.length > 0 ? out : null;
}

/** Stable sort for comparing session group sets. */
export function normalizeGroupKeys(keys: readonly string[]): MuscleGroupKey[] {
  const set = new Set<MuscleGroupKey>();
  for (const key of keys) {
    if (isMuscleGroupKey(key)) {
      set.add(key);
    }
  }
  return MUSCLE_GROUP_KEYS.filter((k) => set.has(k));
}

export function sameGroupSet(a: readonly string[], b: readonly string[]): boolean {
  const na = normalizeGroupKeys(a);
  const nb = normalizeGroupKeys(b);
  if (na.length !== nb.length) return false;
  return na.every((k, i) => k === nb[i]);
}
