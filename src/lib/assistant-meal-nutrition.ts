/**
 * Пустые КБЖУ в карточке чата.
 * Схема извлечения требует числа, поэтому ответ без состава приходит как 0/0/0/0.
 * Такие нули — не измерение: ищем типовую строку справочника и пересчитываем
 * её на названную порцию. Если строки нет, поля остаются пустыми.
 */

import type { AssistantActions } from "@/lib/admin-assistant";
import { looksLikeDrinkName } from "@/lib/portion-unit";
import { splitQuickPortion } from "@/lib/quick-log";
import { dishLooksLikeAlcohol, lookupRuNutritionTable } from "@/lib/ru-nutrition-lookup";

export type AssistantMealDraft = NonNullable<AssistantActions["meals"]>[number];

type NutritionPack = NonNullable<ReturnType<typeof lookupRuNutritionTable>>;

const STATED_NUTRITION_RE =
  /(?:\d+(?:[.,]\d+)?\s*(?:ккал|kcal|калори)|(?:ккал|kcal|калори)\s*[:=]?\s*\d|(?:белк|жир|углевод|protein|fat|carb)\p{L}*\s*[:=—–~\-]?\s*(?:около|примерно|~|≈)?\s*\d)/iu;

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

/** Выше этой плотности у нежирного продукта ккал порции склеили с «100 г». */
export const LEAN_FOOD_DENSITY_CAP = 500;
/** Во сколько раз ккал модели могут разойтись с плотностью справочника. */
const REFERENCE_DENSITY_RATIO = 1.5;

const ENERGY_DENSE_FOOD_RE =
  /масл|орех|арахис|миндал|фундук|кешью|фисташ|пекан|шоколад|семеч|семян|кунжут|сало|шпик|чипс|халв|тахин|урбеч/iu;

/** Масло, орехи, шоколад, семечки, сало, чипсы: больше 500 ккал/100 г для них норма. */
export function looksEnergyDenseFood(name: string): boolean {
  return ENERGY_DENSE_FOOD_RE.test(name.toLowerCase().replace(/ё/g, "е"));
}

/** true, если числа расходятся больше чем в ~1,5 раза. */
export function nutritionFiguresDiverge(model: number, reference: number): boolean {
  if (!(model > 0) || !(reference > 0)) return false;
  const ratio = model / reference;
  return ratio > REFERENCE_DENSITY_RATIO || ratio < 1 / REFERENCE_DENSITY_RATIO;
}

const KCAL_MENTION_RE =
  /(\d{2,4})(?:\s*[-–—]\s*(\d{2,4}))?\s*(?:ккал|kcal|калори)/giu;

/**
 * «на 100 г 240 ккал» — плотность. «≈ 740 ккал» у штуки или порции — съеденное.
 * Если названы оба, порция важнее.
 */
export function replyKcalBreakdown(reply: string | null | undefined): {
  portionKcal: number | null;
  per100Kcal: number | null;
} {
  const text = (reply ?? "").replace(/\u00a0/g, " ");
  let portionKcal: number | null = null;
  let per100Kcal: number | null = null;
  const re = new RegExp(KCAL_MENTION_RE.source, KCAL_MENTION_RE.flags);
  let match: RegExpExecArray | null;
  while ((match = re.exec(text))) {
    const left = Number(match[1]);
    const right = match[2] ? Number(match[2]) : left;
    const kcal = Math.round((left + right) / 2);
    if (!(kcal > 0 && kcal < 5000)) continue;
    const before = text.slice(Math.max(0, match.index - 28), match.index);
    const after = text.slice(match.index, Math.min(text.length, match.index + match[0].length + 18));
    const window = `${before} ${after}`.toLowerCase().replace(/ё/g, "е");
    if (/(?:на|за|\/)\s*100\s*(?:г|гр|грамм|мл)/iu.test(window)) per100Kcal = kcal;
    else portionKcal = kcal;
  }
  return { portionKcal, per100Kcal };
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

function macroSlotEmpty(value: number | undefined): boolean {
  return value == null || value === 0;
}

/** Чай, кофе, алкоголь: нулевые БЖУ при ненулевых ккал — норма, не дырка. */
function drinkMacrosStayEmpty(meal: { name?: string; unit?: string }): boolean {
  if (meal.unit === "мл") return true;
  const name = meal.name ?? "";
  return looksLikeDrinkName(name) || dishLooksLikeAlcohol(name);
}

/**
 * Модель поставила 0, потому что числа в тексте не было.
 * То же, если ккал уже есть, а БЖУ пустые: калории без состава — не измерение.
 * Пропуск полей и напитки с честными нулями — не этот случай.
 */
export function mealMacrosLookUnset(meal: {
  name?: string;
  unit?: string;
  kcal?: number;
  protein?: number;
  fat?: number;
  carbs?: number;
  nutritionBasis?: AssistantMealDraft["nutritionBasis"];
}): boolean {
  if (meal.nutritionBasis === "estimate" || meal.nutritionBasis === "unknown") return false;
  const slots = [meal.kcal, meal.protein, meal.fat, meal.carbs];
  const wroteZero = slots.some((value) => value === 0);
  if (wroteZero && slots.every((value) => value == null || value === 0)) return true;
  const kcalSet = typeof meal.kcal === "number" && meal.kcal > 0;
  const macrosEmpty =
    macroSlotEmpty(meal.protein) && macroSlotEmpty(meal.fat) && macroSlotEmpty(meal.carbs);
  if (!kcalSet || !macrosEmpty) return false;
  if (drinkMacrosStayEmpty(meal)) return false;
  return true;
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
  const { portionKcal, per100Kcal } = replyKcalBreakdown(text);
  return portionKcal ?? per100Kcal;
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

/** Граммы из первой строки корпуса: это фраза пользователя, не черновик модели. */
function leadingLineGrams(corpus: string): number | null {
  const line = (corpus.split(/\r?\n/, 1)[0] ?? "").replace(/\u00a0/g, " ");
  const match = /(\d+(?:[.,]\d+)?)\s*(?:грамм(?:а|ов)?|гр|г|мл)(?=$|\s|[^\p{L}\p{N}])/iu.exec(line);
  if (!match?.[1]) return null;
  const grams = Number(match[1].replace(",", "."));
  if (!Number.isFinite(grams) || grams <= 0 || grams > 20000) return null;
  return Math.round(grams);
}

function mealNamedGrams(meal: AssistantMealDraft): number | null {
  if (typeof meal.grams === "number" && Number.isFinite(meal.grams) && meal.grams > 0) {
    return Math.round(meal.grams);
  }
  const named = splitQuickPortion(meal.name);
  return named.grams != null && named.grams > 0 ? named.grams : null;
}

function withGrams(meal: AssistantMealDraft, grams: number): AssistantMealDraft {
  const named = splitQuickPortion(meal.name);
  const unit = meal.unit === "мл" || named.unit === "мл" ? "мл" : "г";
  const base = named.base.trim() || meal.name.trim();
  return {
    ...meal,
    grams,
    name: `${base} (${grams} ${unit})`.slice(0, 120),
  };
}

/** Ккал порции оставляем, выдуманные граммы убираем. */
function withoutInventedGrams(meal: AssistantMealDraft, kcal: number): AssistantMealDraft {
  const base = splitQuickPortion(meal.name).base.trim() || meal.name.trim();
  const next: AssistantMealDraft = { ...meal, name: base, kcal };
  delete next.grams;
  if (macroSlotEmpty(next.protein)) delete next.protein;
  if (macroSlotEmpty(next.fat)) delete next.fat;
  if (macroSlotEmpty(next.carbs)) delete next.carbs;
  return next;
}

function enrichOne(meal: AssistantMealDraft, corpus: string): AssistantMealDraft {
  if (!mealMacrosLookUnset(meal)) return meal;
  const stated = statedNutrition(dishContext(meal.name, corpus));
  if (stated?.kind === "zeros") return meal;
  if (
    stated?.kind === "numbers" &&
    (stated.protein != null || stated.fat != null || stated.carbs != null)
  ) {
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
  const userGrams = leadingLineGrams(corpus);
  const attached = mealNamedGrams(meal);
  const modelKcal =
    typeof meal.kcal === "number" && meal.kcal > 0
      ? meal.kcal
      : stated?.kind === "numbers"
        ? stated.kcal
        : null;
  const dense = looksEnergyDenseFood(named.base || meal.name);
  const pack = lookupPack(meal.name);

  if (!pack) {
    if (
      modelKcal != null &&
      userGrams == null &&
      attached != null &&
      !dense &&
      (modelKcal / attached) * 100 > LEAN_FOOD_DENSITY_CAP
    ) {
      return withoutInventedGrams(meal, modelKcal);
    }
    if (modelKcal != null) return meal;
    return clearMacros(meal);
  }

  const per100 = referencePer100(pack);
  let grams = userGrams ?? attached;
  let trustTable = modelKcal == null;

  if (modelKcal != null && grams != null) {
    const density = (modelKcal / grams) * 100;
    const off = nutritionFiguresDiverge(density, per100.calories);
    if (off) trustTable = true;
    // Пользователь граммы не писал, а плотность нежирного продукта неправдоподобна.
    if (userGrams == null && !dense && (density > LEAN_FOOD_DENSITY_CAP || off)) {
      grams = pack.portionGrams > 0 ? Math.round(pack.portionGrams) : null;
      trustTable = true;
    }
  }

  if (grams == null) {
    if (modelKcal == null) {
      const next = clearMacros(meal);
      return { ...next, per100, nutritionBasis: "estimate" };
    }
    if (!(pack.portionGrams > 0)) {
      return { ...meal, kcal: modelKcal, per100, nutritionBasis: "estimate" };
    }
    grams = Math.round(pack.portionGrams);
    const typical = scalePack(pack, grams);
    if (nutritionFiguresDiverge(modelKcal, typical.kcal)) trustTable = true;
  }

  const scaled = scalePack(pack, grams);
  const next = withGrams(meal, grams);
  return {
    ...next,
    kcal: trustTable || modelKcal == null ? scaled.kcal : modelKcal,
    protein: scaled.protein,
    fat: scaled.fat,
    carbs: scaled.carbs,
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
