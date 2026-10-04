export const SET_TYPES = ["warmup", "working", "drop", "failure", "rest_pause"] as const;

export type SetType = (typeof SET_TYPES)[number];

export const SET_TYPE_LABELS: Record<SetType, string> = {
  warmup: "Разминка",
  working: "Рабочий",
  drop: "Дроп",
  failure: "Отказ",
  rest_pause: "Отдых-пауза",
};

/** Short Russian labels shown on set chips (tap to cycle). */
export const SET_TYPE_SHORT: Record<SetType, string> = {
  warmup: "Рзм",
  working: "Раб",
  drop: "Дроп",
  failure: "Отказ",
  /** Was "RP" — confused with RPE; spell out. */
  rest_pause: "О-п",
};

/** Effort field (was labeled "RPE" — unclear for RU users). */
export const EFFORT_FIELD_LABEL = "Усилие";
export const EFFORT_FIELD_HINT = "1 легко · 10 отказ";
export const EFFORT_FIELD_ARIA = "Усилие — насколько тяжело было, от 1 (легко) до 10 (отказ)";

export function isSetType(value: unknown): value is SetType {
  return typeof value === "string" && (SET_TYPES as readonly string[]).includes(value);
}

export function parseSetType(raw: unknown, fallback: SetType = "working"): SetType {
  if (isSetType(raw)) return raw;
  return fallback;
}

/** Warmup sets do not count toward session tonnage. */
export function setCountsTowardLoad(set: {
  setType?: string | null;
  completed?: boolean | null;
}): boolean {
  if (set.completed === false) return false;
  return parseSetType(set.setType) !== "warmup";
}

export function parseRpe(raw: unknown): number | null | undefined {
  if (raw === undefined) return undefined;
  if (raw === null || raw === "") return null;
  const n = typeof raw === "number" ? raw : Number(raw);
  if (!Number.isFinite(n) || n < 1 || n > 10) return null;
  return Math.round(n * 2) / 2; // allow 0.5 steps
}

export function parseOptionalNote(raw: unknown, max = 200): string | null | undefined {
  if (raw === undefined) return undefined;
  if (raw === null) return null;
  if (typeof raw !== "string") return undefined;
  const trimmed = raw.trim().slice(0, max);
  return trimmed.length > 0 ? trimmed : null;
}
