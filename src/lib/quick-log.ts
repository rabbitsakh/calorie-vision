/**
 * «Проверь и запиши» sheet on «Сегодня»: one phrase → assistant draft → dish rows.
 * Pure helpers — portion parsing/rescale, totals, slot label, save CTA copy.
 */

import type { AssistantActions } from "@/lib/admin-assistant";

export type QuickMeal = NonNullable<AssistantActions["meals"]>[number];

export type QuickPortion = { base: string; grams: number | null; unit: "г" | "мл" };

const PORTION_IN_PARENS_RE = /\s*\((\d+(?:[.,]\d+)?)\s*(г|гр|грамм\S*|мл)\)\s*$/iu;
const PORTION_TRAILING_RE = /\s+(\d+(?:[.,]\d+)?)\s*(г|гр|грамм\S*|мл)\.?\s*$/iu;

/** «Творог (200 г)» / «Молоко 100 мл» → base name + grams. */
export function splitQuickPortion(name: string): QuickPortion {
  const raw = name.trim();
  const m = PORTION_IN_PARENS_RE.exec(raw) ?? PORTION_TRAILING_RE.exec(raw);
  if (!m?.[1]) return { base: raw, grams: null, unit: "г" };
  const grams = Number(m[1].replace(",", "."));
  const unit = /^мл/i.test(m[2] ?? "") ? "мл" : "г";
  if (!Number.isFinite(grams) || grams <= 0) return { base: raw, grams: null, unit };
  return { base: raw.slice(0, m.index).trim() || raw, grams: Math.round(grams), unit };
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

const SLOT_LABEL: Record<string, string> = {
  завтрак: "Завтрак",
  обед: "Обед",
  ужин: "Ужин",
  перекус: "Перекус",
};

function slotOf(meals: QuickMeal[]): string | null {
  for (const m of meals) {
    const key = m.note?.trim().toLowerCase();
    if (key && SLOT_LABEL[key]) return key;
  }
  return null;
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
