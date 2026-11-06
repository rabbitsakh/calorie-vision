/**
 * Пустые КБЖУ в карточке чата.
 * Схема извлечения требует числа, поэтому ответ без состава приходит как 0/0/0/0.
 * Такие нули — не измерение: ищем типовую строку справочника и пересчитываем
 * её на названную порцию. Если строки нет, поля остаются пустыми.
 */

import type { AssistantActions } from "@/lib/admin-assistant";
import { splitQuickPortion } from "@/lib/quick-log";
import { lookupRuNutritionTable } from "@/lib/ru-nutrition-lookup";

export type AssistantMealDraft = NonNullable<AssistantActions["meals"]>[number];

type NutritionPack = NonNullable<ReturnType<typeof lookupRuNutritionTable>>;

const STATED_NUTRITION_RE =
  /(?:\d+(?:[.,]\d+)?\s*(?:ккал|kcal|калори)|(?:ккал|kcal|калори)\s*[:=]?\s*\d|(?:белк|жир|углевод|protein|fat|carb)\p{L}*\s*[:=—–~\-]?\s*(?:около|примерно|~|≈)?\s*\d)/iu;

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

/** Плотность на 100 г/мл. Ноль нутриента сохраняется. */
export function referencePer100(pack: {
  calories: number;
  protein?: number;
  fat?: number;
  carbs?: number;
  portionGrams?: number;
}): NonNullable<AssistantMealDraft["per100"]> {
  const portion = pack.portionGrams && pack.portionGrams > 0 ? pack.portionGrams : 100;
  const ratio = 100 / portion;
  const scale = (value: number | undefined) =>
    value == null || !Number.isFinite(value) ? undefined : round1(value * ratio);
  return {
    calories: Math.max(0, Math.round((Number(pack.calories) || 0) * ratio)),
    protein: scale(pack.protein),
    fat: scale(pack.fat),
    carbs: scale(pack.carbs),
  };
}

function scalePack(pack: NutritionPack, grams: number) {
  const base = pack.portionGrams > 0 ? pack.portionGrams : 100;
  const scale = grams / base;
  const macro = (value: number | undefined) =>
    value == null || !Number.isFinite(value) ? undefined : round1(value * scale);
  return {
    kcal: Math.round((Number(pack.calories) || 0) * scale),
    protein: macro(pack.protein),
    fat: macro(pack.fat),
    carbs: macro(pack.carbs),
  };
}

/** Модель поставила 0, потому что числа в тексте не было. Пропуск полей — не этот случай. */
export function mealMacrosLookUnset(meal: {
  kcal?: number;
  protein?: number;
  fat?: number;
  carbs?: number;
  nutritionBasis?: AssistantMealDraft["nutritionBasis"];
}): boolean {
  if (meal.nutritionBasis === "estimate" || meal.nutritionBasis === "unknown") return false;
  const slots = [meal.kcal, meal.protein, meal.fat, meal.carbs];
  const wroteZero = slots.some((value) => value === 0);
  if (!wroteZero) return false;
  return slots.every((value) => value == null || value === 0);
}

function fold(text: string): string {
  return text.toLowerCase().replace(/ё/g, "е");
}

function dishContext(name: string, corpus: string): string {
  const base = fold(splitQuickPortion(name).base || name);
  const tokens = base.split(/[^\p{L}\p{N}]+/u).filter((token) => token.length >= 3);
  if (!tokens.length && base.length >= 2) tokens.push(base);
  const lines = corpus
    .split(/\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  const hits = lines.filter((line) => {
    const folded = fold(line);
    return tokens.some((token) => folded.includes(token));
  });
  if (hits.length) return hits.join("\n");
  if (lines.length <= 4) return corpus;
  return "";
}

function readKcal(text: string): number | null {
  const match = /(\d{1,4})(?:\s*[-–—]\s*(\d{1,4}))?\s*(?:ккал|kcal|калори)/iu.exec(text);
  if (!match?.[1]) return null;
  const left = Number(match[1]);
  const right = match[2] ? Number(match[2]) : left;
  const kcal = Math.round((left + right) / 2);
  if (!Number.isFinite(kcal) || kcal < 0 || kcal >= 5000) return null;
  return kcal;
}

function readMacro(text: string, label: string): number | undefined {
  const match = new RegExp(
    String.raw`(?:${label})\p{L}*\s*[:=—–~\-]?\s*(?:около|примерно|~|≈)?\s*(\d+(?:[.,]\d+)?)`,
    "iu",
  ).exec(text);
  if (!match?.[1]) return undefined;
  const value = Number(match[1].replace(",", "."));
  if (!Number.isFinite(value) || value < 0 || value > 500) return undefined;
  return value;
}

function statedNutrition(
  text: string,
): { kind: "zeros" } | { kind: "numbers"; kcal: number; protein?: number; fat?: number; carbs?: number } | null {
  if (!text.trim() || !STATED_NUTRITION_RE.test(text)) return null;
  const kcal = readKcal(text);
  if (kcal == null || kcal === 0) return { kind: "zeros" };
  return {
    kind: "numbers",
    kcal,
    protein: readMacro(text, "белк|protein"),
    fat: readMacro(text, "жир|fat"),
    carbs: readMacro(text, "углевод|carb"),
  };
}

function lookupPack(name: string): NutritionPack | null {
  const base = splitQuickPortion(name).base.trim() || name.trim();
  const nominative = fold(base)
    .split(/\s+/)
    .map((token) => (token.length >= 6 && /[ая]$/u.test(token) ? token.slice(0, -1) : token))
    .join(" ")
    .trim();
  for (const query of [base, nominative]) {
    if (query.length < 3) continue;
    const hit = lookupRuNutritionTable(query);
    if (hit) return hit;
  }
  return null;
}

function clearMacros(meal: AssistantMealDraft): AssistantMealDraft {
  const next: AssistantMealDraft = { ...meal, nutritionBasis: "unknown" };
  delete next.kcal;
  delete next.protein;
  delete next.fat;
  delete next.carbs;
  return next;
}

function enrichOne(meal: AssistantMealDraft, corpus: string): AssistantMealDraft {
  if (!mealMacrosLookUnset(meal)) return meal;
  const stated = statedNutrition(dishContext(meal.name, corpus));
  if (stated?.kind === "zeros") return meal;
  if (stated?.kind === "numbers") {
    const next: AssistantMealDraft = { ...meal, kcal: stated.kcal };
    if (stated.protein === undefined) delete next.protein;
    else next.protein = stated.protein;
    if (stated.fat === undefined) delete next.fat;
    else next.fat = stated.fat;
    if (stated.carbs === undefined) delete next.carbs;
    else next.carbs = stated.carbs;
    return next;
  }

  const named = splitQuickPortion(meal.name);
  const grams =
    typeof meal.grams === "number" && Number.isFinite(meal.grams) && meal.grams > 0
      ? Math.round(meal.grams)
      : named.grams != null && named.grams > 0
        ? named.grams
        : null;
  const pack = lookupPack(meal.name);
  if (!pack) return clearMacros(meal);

  const per100 = referencePer100(pack);
  if (grams == null) {
    const next = clearMacros(meal);
    return { ...next, per100, nutritionBasis: "estimate" };
  }
  return {
    ...meal,
    grams,
    ...scalePack(pack, grams),
    per100,
    nutritionBasis: "estimate",
  };
}

export function enrichUnsetMealNutrition(
  meals: AssistantMealDraft[],
  corpus: string,
): AssistantMealDraft[] {
  return meals.map((meal) => enrichOne(meal, corpus));
}
