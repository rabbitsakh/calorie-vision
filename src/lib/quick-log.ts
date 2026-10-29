/**
 * «Проверь и запиши» sheet on «Сегодня»: one phrase → assistant draft → dish rows.
 * Pure helpers — portion parsing/rescale, totals, slot label, save CTA copy.
 */

import type { AssistantActions } from "@/lib/admin-assistant";

export type QuickMeal = NonNullable<AssistantActions["meals"]>[number];

export type QuickPortion = { base: string; grams: number | null; unit: "г" | "мл" };

/** Unit alts: longer first so «гр» wins over «г». */
const UNIT_ALT = "мл|грамм\\S*|гр|г";
const PORTION_IN_PARENS_RE = new RegExp(
  String.raw`\s*\((\d+(?:[.,]\d+)?)\s*(${UNIT_ALT})\)\s*$`,
  "iu",
);
/** Allow «100мл» without a space before the unit. */
const PORTION_TRAILING_RE = new RegExp(
  String.raw`\s+(\d+(?:[.,]\d+)?)\s*(${UNIT_ALT})\.?\s*$`,
  "iu",
);
const PORTION_LOOSE_RE = new RegExp(String.raw`(\d+(?:[.,]\d+)?)\s*(${UNIT_ALT})(?![а-яёa-z])`, "iu");
const PORTION_HINT_RE = new RegExp(
  String.raw`([А-Яа-яЁёA-Za-z][А-Яа-яЁёA-Za-z\s.%]*?)\s*(\d+(?:[.,]\d+)?)\s*(${UNIT_ALT})(?![а-яёa-z])`,
  "giu",
);
const LIQUID_NAME_RE = /молок|сок|кофе|чай|кефир|напит|вода|пиво|wine|milk|йогурт\s*пит|латте|какао/i;

function portionUnit(raw: string | undefined): "г" | "мл" {
  return /^мл/i.test(raw ?? "") ? "мл" : "г";
}

function parsePortionMatch(m: RegExpExecArray, baseFallback: string): QuickPortion | null {
  const grams = Number((m[1] ?? "").replace(",", "."));
  const unit = portionUnit(m[2]);
  if (!Number.isFinite(grams) || grams <= 0) return null;
  const base =
    typeof m.index === "number" && m.index > 0
      ? baseFallback.slice(0, m.index).trim() || baseFallback
      : baseFallback;
  return { base: base || baseFallback, grams: Math.round(grams), unit };
}

/** «Творог (200 г)» / «Молоко 100 мл» / «Молоко 100мл» → base name + grams. */
export function splitQuickPortion(name: string): QuickPortion {
  const raw = name.trim();
  const m = PORTION_IN_PARENS_RE.exec(raw) ?? PORTION_TRAILING_RE.exec(raw);
  if (!m?.[1]) return { base: raw, grams: null, unit: "г" };
  return parsePortionMatch(m, raw) ?? { base: raw, grams: null, unit: "г" };
}

function normalizeDishKey(s: string): string {
  return s
    .toLowerCase()
    .replace(/ё/g, "е")
    .replace(/[^а-яa-z0-9]+/gi, " ")
    .trim();
}

/** Soft stem tokens — «Курина» ↔ «Куриная». */
function dishTokens(s: string): string[] {
  return normalizeDishKey(s)
    .split(/\s+/)
    .filter((t) => t.length >= 3)
    .map((t) => t.slice(0, 5));
}

export function dishNameScore(a: string, b: string): number {
  const ta = dishTokens(a);
  const tb = dishTokens(b);
  if (!ta.length || !tb.length) return 0;
  let hits = 0;
  for (const t of ta) {
    if (tb.some((u) => u === t || u.startsWith(t) || t.startsWith(u))) hits += 1;
  }
  return hits / Math.max(ta.length, tb.length);
}

/**
 * «Молоко 100мл и Курина грудка 500гр» → [{Молоко,100,мл}, {Курина грудка,500,г}].
 */
export function extractPortionHints(text: string): QuickPortion[] {
  const raw = text.trim();
  if (!raw) return [];
  const hints: QuickPortion[] = [];
  const re = new RegExp(PORTION_HINT_RE.source, PORTION_HINT_RE.flags);
  let m: RegExpExecArray | null;
  while ((m = re.exec(raw))) {
    const base = (m[1] ?? "")
      .replace(/^(?:и|или|,|;|\+|да)\s+/i, "")
      .replace(/\s+/g, " ")
      .trim();
    const grams = Number((m[2] ?? "").replace(",", "."));
    const unit = portionUnit(m[3]);
    if (!base || !Number.isFinite(grams) || grams <= 0) continue;
    hints.push({ base, grams: Math.round(grams), unit });
  }
  return hints;
}

/** Pull «100 мл» from the composer phrase for one dish. */
export function portionFromUserText(text: string, dishBase?: string): QuickPortion | null {
  const hints = extractPortionHints(text);
  if (dishBase?.trim() && hints.length) {
    let best: QuickPortion | null = null;
    let bestScore = 0;
    for (const h of hints) {
      const score = dishNameScore(dishBase, h.base);
      if (score > bestScore) {
        bestScore = score;
        best = { ...h, base: dishBase.trim() };
      }
    }
    if (best && bestScore >= 0.4) return best;
  }
  if (hints.length === 1) {
    return { ...hints[0]!, base: dishBase?.trim() || hints[0]!.base };
  }
  const raw = text.trim();
  if (!raw) return null;
  if (dishBase?.trim()) {
    const base = dishBase.trim();
    const escaped = base.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const near = new RegExp(
      `${escaped}[^\\d]{0,24}(\\d+(?:[.,]\\d+)?)\\s*(${UNIT_ALT})(?![а-яёa-z])`,
      "iu",
    );
    const m = near.exec(raw);
    if (m?.[1]) {
      const grams = Number(m[1].replace(",", "."));
      const unit = portionUnit(m[2]);
      if (Number.isFinite(grams) && grams > 0) {
        return { base, grams: Math.round(grams), unit };
      }
    }
  }
  const split = splitQuickPortion(raw);
  if (split.grams != null) return split;
  const loose = PORTION_LOOSE_RE.exec(raw);
  if (!loose?.[1]) return null;
  const grams = Number(loose[1].replace(",", "."));
  const unit = portionUnit(loose[2]);
  if (!Number.isFinite(grams) || grams <= 0) return null;
  return { base: dishBase?.trim() || split.base, grams: Math.round(grams), unit };
}

function defaultQuickUnit(name: string, text: string): "г" | "мл" {
  return LIQUID_NAME_RE.test(`${name} ${text}`) ? "мл" : "г";
}

/**
 * Ensure every draft meal has «(N г|мл)» so the gram control always appears.
 * User phrase wins over a wrong AI label (keep AI kcal — usually for the right amount).
 */
export function enrichQuickMealsFromText(meals: QuickMeal[], text: string): QuickMeal[] {
  const hints = extractPortionHints(text);
  const used = new Set<number>();
  return meals.map((meal, index) => {
    const current = splitQuickPortion(meal.name);
    let hint: QuickPortion | null = null;
    let bestScore = 0;
    let bestIdx = -1;
    for (let i = 0; i < hints.length; i += 1) {
      if (used.has(i)) continue;
      const h = hints[i]!;
      const score = dishNameScore(current.base, h.base);
      if (score > bestScore) {
        bestScore = score;
        hint = h;
        bestIdx = i;
      }
    }
    if (!hint && meals.length === 1 && hints.length === 1) {
      hint = hints[0]!;
      bestIdx = 0;
      bestScore = 1;
    }
    if (!hint && meals.length === hints.length && !used.has(index)) {
      hint = hints[index] ?? null;
      bestIdx = hint ? index : -1;
      bestScore = hint ? 1 : 0;
    }
    if (hint && bestScore >= 0.34 && bestIdx >= 0) {
      used.add(bestIdx);
      return {
        ...meal,
        name: `${current.base} (${hint.grams} ${hint.unit})`,
      };
    }
    if (current.grams != null) {
      const normalized = `${current.base} (${current.grams} ${current.unit})`;
      return meal.name === normalized ? meal : { ...meal, name: normalized };
    }
    const unit = defaultQuickUnit(current.base, text);
    return { ...meal, name: `${current.base} (100 ${unit})` };
  });
}

export type QuickSlot = "завтрак" | "обед" | "ужин" | "перекус";

export const QUICK_SLOTS: readonly QuickSlot[] = ["завтрак", "обед", "ужин", "перекус"];

/** Default slot from local hour when AI did not set note. */
export function defaultQuickSlot(hour = new Date().getHours()): QuickSlot {
  if (hour >= 5 && hour < 11) return "завтрак";
  if (hour >= 11 && hour < 16) return "обед";
  if (hour >= 16 && hour < 21) return "ужин";
  return "перекус";
}

export function applyQuickSlot(meals: QuickMeal[], slot: QuickSlot): QuickMeal[] {
  return meals.map((m) => ({ ...m, note: slot }));
}

function scaleNum(v: number | undefined, k: number, digits = 1): number | undefined {
  if (typeof v !== "number" || !Number.isFinite(v)) return v;
  const p = 10 ** digits;
  return Math.round(v * k * p) / p;
}

/** New grams → kcal and macros scale proportionally; name keeps «(N г)». */
export function rescaleQuickMeal(meal: QuickMeal, grams: number): QuickMeal {
  const portion = splitQuickPortion(meal.name);
  const next = Math.max(1, Math.round(grams));
  if (!portion.grams || portion.grams === next) return meal;
  const k = next / portion.grams;
  return {
    ...meal,
    name: `${portion.base} (${next} ${portion.unit})`,
    kcal: typeof meal.kcal === "number" ? Math.round(meal.kcal * k) : meal.kcal,
    protein: scaleNum(meal.protein, k),
    fat: scaleNum(meal.fat, k),
    carbs: scaleNum(meal.carbs, k),
  };
}

/** Same step as the confirm card: 10 г / 50 мл, 5 г for small portions. */
export function quickPortionStep(grams: number, unit: "г" | "мл"): number {
  if (unit === "мл") return grams >= 200 ? 50 : 25;
  if (grams < 30) return 5;
  return 10;
}

export type QuickTotals = { kcal: number; protein: number; fat: number; carbs: number };

export function quickTotals(meals: QuickMeal[]): QuickTotals {
  const t = { kcal: 0, protein: 0, fat: 0, carbs: 0 };
  for (const m of meals) {
    t.kcal += m.kcal ?? 0;
    t.protein += m.protein ?? 0;
    t.fat += m.fat ?? 0;
    t.carbs += m.carbs ?? 0;
  }
  return {
    kcal: Math.round(t.kcal),
    protein: Math.round(t.protein),
    fat: Math.round(t.fat),
    carbs: Math.round(t.carbs),
  };
}

export const SLOT_LABEL: Record<QuickSlot, string> = {
  завтрак: "Завтрак",
  обед: "Обед",
  ужин: "Ужин",
  перекус: "Перекус",
};

function slotOf(meals: QuickMeal[]): QuickSlot | null {
  for (const m of meals) {
    const key = m.note?.trim().toLowerCase();
    if (key === "завтрак" || key === "обед" || key === "ужин" || key === "перекус") {
      return key;
    }
  }
  return null;
}

export function resolveQuickSlot(meals: QuickMeal[], hour?: number): QuickSlot {
  return slotOf(meals) ?? defaultQuickSlot(hour);
}

/** «Завтрак · 07:00» tag over the rows. */
export function quickSlotTag(meals: QuickMeal[]): string | null {
  const slot = slotOf(meals);
  const time = meals.find((m) => /^\d{1,2}:\d{2}$/.test(m.time ?? ""))?.time ?? null;
  if (!slot && !time) return null;
  return [slot ? SLOT_LABEL[slot] : null, time].filter(Boolean).join(" · ");
}

/** «Записать в завтрак · 469 ккал». */
export function quickSaveLabel(meals: QuickMeal[], kcal: number): string {
  const slot = slotOf(meals);
  return `Записать${slot ? ` в ${slot}` : ""} · ${Math.round(kcal)} ккал`;
}

export function quickHeader(count: number): string {
  if (count <= 1) return "Нашёл блюдо — проверь граммы";
  const n10 = count % 10;
  const n100 = count % 100;
  const word =
    n10 === 1 && n100 !== 11
      ? "блюдо"
      : n10 >= 2 && n10 <= 4 && (n100 < 12 || n100 > 14)
        ? "блюда"
        : "блюд";
  return `Нашёл ${count} ${word} — проверь граммы`;
}

export function quickMacroLine(meal: QuickMeal): string {
  const f = (v?: number) =>
    typeof v === "number" ? v.toLocaleString("ru-RU", { maximumFractionDigits: 1 }) : "—";
  return `Б ${f(meal.protein)} · Ж ${f(meal.fat)} · У ${f(meal.carbs)}`;
}

const TONES = [
  { bg: "#eef6f2", fg: "#0f5c5e" },
  { bg: "#e0f2fe", fg: "#0284c7" },
  { bg: "#fffbeb", fg: "#d97706" },
  { bg: "#f8f3eb", fg: "#92510a" },
] as const;

export function quickDishTone(index: number): { bg: string; fg: string } {
  return TONES[index % TONES.length]!;
}
