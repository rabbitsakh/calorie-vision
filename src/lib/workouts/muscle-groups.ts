export const MUSCLE_GROUP_KEYS = [
  "chest",
  "back",
  "legs",
  "shoulders",
  "biceps",
  "triceps",
  "abs",
  "cardio",
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
  { key: "cardio", label: "Кардио" },
  { key: "other", label: "Другое" },
];

const LABEL_BY_KEY = Object.fromEntries(MUSCLE_GROUPS.map((g) => [g.key, g.label])) as Record<
  MuscleGroupKey,
  string
>;

export function isMuscleGroupKey(value: string): value is MuscleGroupKey {
  return (MUSCLE_GROUP_KEYS as readonly string[]).includes(value);
}

/**
 * Мелкие и разговорные названия → одна из групп карты.
 * Квадрицепс, бицепс бедра, ягодицы и икры — это «Ноги».
 * Передняя, средняя и задняя дельта — «Плечи».
 */
const MUSCLE_ALIASES: Record<string, MuscleGroupKey> = {
  leg: "legs",
  quad: "legs",
  quads: "legs",
  quadricep: "legs",
  quadriceps: "legs",
  hamstring: "legs",
  hamstrings: "legs",
  glute: "legs",
  glutes: "legs",
  gluteus: "legs",
  calf: "legs",
  calves: "legs",
  adductor: "legs",
  adductors: "legs",
  abductor: "legs",
  abductors: "legs",
  hip: "legs",
  hips: "legs",
  ноги: "legs",
  нога: "legs",
  квадрицепс: "legs",
  квадрицепсы: "legs",
  "бицепс-бедра": "legs",
  "задняя-поверхность-бедра": "legs",
  бедро: "legs",
  бедра: "legs",
  ягодицы: "legs",
  ягодица: "legs",
  икры: "legs",
  икра: "legs",

  shoulder: "shoulders",
  delt: "shoulders",
  delts: "shoulders",
  deltoid: "shoulders",
  deltoids: "shoulders",
  "front-delt": "shoulders",
  "rear-delt": "shoulders",
  "side-delt": "shoulders",
  "lateral-delt": "shoulders",
  "anterior-delt": "shoulders",
  "posterior-delt": "shoulders",
  "middle-delt": "shoulders",
  плечи: "shoulders",
  плечо: "shoulders",
  дельты: "shoulders",
  дельта: "shoulders",
  "передняя-дельта": "shoulders",
  "средняя-дельта": "shoulders",
  "задняя-дельта": "shoulders",

  pec: "chest",
  pecs: "chest",
  pectoral: "chest",
  pectorals: "chest",
  грудь: "chest",
  грудные: "chest",

  lat: "back",
  lats: "back",
  latissimus: "back",
  trap: "back",
  traps: "back",
  trapezius: "back",
  rhomboid: "back",
  rhomboids: "back",
  erector: "back",
  erectors: "back",
  спина: "back",
  широчайшие: "back",
  трапеции: "back",

  bicep: "biceps",
  бицепс: "biceps",
  бицепсы: "biceps",

  tricep: "triceps",
  трицепс: "triceps",
  трицепсы: "triceps",

  ab: "abs",
  core: "abs",
  abdominals: "abs",
  пресс: "abs",
  кор: "abs",

  cardios: "cardio",
  кардио: "cardio",

  прочее: "other",
  другое: "other",
};

function muscleToken(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .replaceAll("ё", "е")
    .replace(/[_\s]+/g, "-")
    .replace(/-+/g, "-");
}

/** Ключ группы или null, если строку нельзя отнести ни к одной. */
export function canonicalizeMuscleKey(raw: string): MuscleGroupKey | null {
  const token = muscleToken(raw);
  if (!token) return null;
  if (isMuscleGroupKey(token)) return token;
  return MUSCLE_ALIASES[token] ?? null;
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
