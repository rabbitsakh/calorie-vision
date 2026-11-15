/**
 * Вечерний итог дня: съедено / норма, спокойные фразы и 2–3 варианта,
 * чем добрать недостающее, не выходя за остаток калорий.
 * Детерминированно, без LLM и внешних справочников.
 */

import { formatWaterLiters, formatWaterOf } from "@/lib/water-display";

export const EVENING_SUMMARY_START_HOUR = 18;

const CALORIE_ABS = 80;
const CALORIE_RATIO = 0.05;
const PROTEIN_ABS = 8;
const PROTEIN_RATIO = 0.1;
const FAT_ABS = 6;
const FAT_RATIO = 0.12;
const CARBS_ABS = 15;
const CARBS_RATIO = 0.1;
const WATER_ABS_ML = 150;
const WATER_RATIO = 0.08;

/** Ниже этого остатка еду не предлагаем: порция была бы символической. */
const MIN_REMAINING_KCAL = 40;
/** Доля привычной порции, ниже которой масштаб уже не «то же блюдо». */
const MIN_SCALE_FACTOR = 0.4;

export type EveningTotals = {
  calories: number;
  protein: number;
  fat: number;
  carbs: number;
  waterMl: number;
};

export type EveningTargets = {
  calories: number | null;
  protein: number | null;
  fat: number | null;
  carbs: number | null;
  waterMl: number | null;
};

export type EveningFoodInput = {
  name: string;
  calories: number;
  protein?: number | null;
  fat?: number | null;
  carbs?: number | null;
  portionGrams?: number | null;
  customFoodId?: string | null;
  useCount?: number;
};

export type EveningSuggestion = {
  key: string;
  name: string;
  label: string;
  dishName: string;
  calories: number;
  protein: number;
  fat: number;
  carbs: number;
  portionGrams: number | null;
  source: "history" | "catalog";
  customFoodId: string | null;
};

export type EveningStat = {
  key: "calories" | "protein" | "fat" | "carbs" | "water";
  label: string;
  short: string;
  text: string;
};

export type EveningSummary = {
  stats: EveningStat[];
  phrases: string[];
  suggestions: EveningSuggestion[];
};

type MacroKey = "protein" | "fat" | "carbs";
type Focus = MacroKey | "calories";

type PortionUnit = "г" | "мл" | "шт";

type CatalogPiece = {
  count: number;
  grams: number;
  calories: number;
  protein: number;
  fat: number;
  carbs: number;
};

type CatalogFood = {
  id: string;
  name: string;
  unit: PortionUnit;
  per100: { calories: number; protein: number; fat: number; carbs: number };
  min: number;
  max: number;
  step: number;
  pieces?: CatalogPiece[];
};

/**
 * Короткий локальный справочник на вечер. Не общий каталог продуктов:
 * его параллельно меняет другой поток, сюда эти правки не входят.
 */
const EVENING_CATALOG: CatalogFood[] = [
  {
    id: "cottage-0",
    name: "Творог 0%",
    unit: "г",
    per100: { calories: 71, protein: 18, fat: 0.5, carbs: 1.5 },
    min: 50,
    max: 250,
    step: 50,
  },
  {
    id: "kefir-1",
    name: "Кефир 1%",
    unit: "мл",
    per100: { calories: 40, protein: 3, fat: 1, carbs: 4 },
    min: 100,
    max: 400,
    step: 50,
  },
  {
    id: "egg",
    name: "Яйцо варёное",
    unit: "шт",
    per100: { calories: 156, protein: 12.6, fat: 10.6, carbs: 1.2 },
    min: 50,
    max: 100,
    step: 50,
    pieces: [
      { count: 1, grams: 50, calories: 78, protein: 6.3, fat: 5.3, carbs: 0.6 },
      { count: 2, grams: 100, calories: 156, protein: 12.6, fat: 10.6, carbs: 1.2 },
    ],
  },
  {
    id: "chicken",
    name: "Куриная грудка",
    unit: "г",
    per100: { calories: 113, protein: 23, fat: 1.8, carbs: 0 },
    min: 50,
    max: 200,
    step: 50,
  },
  {
    id: "greek",
    name: "Греческий йогурт 2%",
    unit: "г",
    per100: { calories: 73, protein: 10, fat: 2, carbs: 3.6 },
    min: 100,
    max: 200,
    step: 50,
  },
  {
    id: "buckwheat",
    name: "Гречка отварная",
    unit: "г",
    per100: { calories: 110, protein: 4.2, fat: 1.1, carbs: 21 },
    min: 100,
    max: 250,
    step: 50,
  },
  {
    id: "banana",
    name: "Банан",
    unit: "г",
    per100: { calories: 89, protein: 1.1, fat: 0.3, carbs: 23 },
    min: 80,
    max: 150,
    step: 10,
  },
  {
    id: "oats",
    name: "Овсянка на воде",
    unit: "г",
    per100: { calories: 88, protein: 3, fat: 1.7, carbs: 15 },
    min: 150,
    max: 300,
    step: 50,
  },
  {
    id: "almond",
    name: "Миндаль",
    unit: "г",
    per100: { calories: 579, protein: 21, fat: 50, carbs: 22 },
    min: 10,
    max: 30,
    step: 5,
  },
  {
    id: "avocado",
    name: "Авокадо",
    unit: "г",
    per100: { calories: 160, protein: 2, fat: 15, carbs: 9 },
    min: 50,
    max: 100,
    step: 25,
  },
  {
    id: "bread",
    name: "Хлеб цельнозерновой",
    unit: "г",
    per100: { calories: 230, protein: 8, fat: 3.5, carbs: 42 },
    min: 30,
    max: 60,
    step: 10,
  },
];

const MACRO_META: Record<
  MacroKey,
  { name: string; abs: number; ratio: number }
> = {
  protein: { name: "белка", abs: PROTEIN_ABS, ratio: PROTEIN_RATIO },
  fat: { name: "жира", abs: FAT_ABS, ratio: FAT_RATIO },
  carbs: { name: "углеводов", abs: CARBS_ABS, ratio: CARBS_RATIO },
};

export function isEveningSummaryWindow(hour: number): boolean {
  return Number.isFinite(hour) && hour >= EVENING_SUMMARY_START_HOUR && hour <= 23;
}

export function shouldShowEveningDaySummary(input: {
  isToday: boolean;
  hour: number;
  entryCount: number;
}): boolean {
  return input.isToday && isEveningSummaryWindow(input.hour) && input.entryCount > 0;
}

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

function inBand(actual: number, target: number, absSlack: number, ratio: number): boolean {
  const diff = Math.abs(target - actual);
  return diff <= Math.max(absSlack, target * ratio);
}

function positiveTarget(value: number | null | undefined): number | null {
  if (value == null || !Number.isFinite(value) || value <= 0) return null;
  return value;
}

function formatInt(value: number): string {
  return Math.round(value).toLocaleString("ru-RU");
}

function normalizeFoodName(name: string): string {
  return name
    .toLowerCase()
    .replace(/ё/g, "е")
    .replace(/[.,]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function drinkUnit(name: string): boolean {
  return /кефир|молок|ряженк|сок\b/i.test(name);
}

function portionSuffix(amount: number | null, unit: PortionUnit, pieces?: number): string | null {
  if (unit === "шт" && pieces) return `${pieces} шт`;
  if (amount == null || amount <= 0) return null;
  return `${Math.round(amount)} ${unit}`;
}

function buildSuggestion(input: {
  name: string;
  calories: number;
  protein: number;
  fat: number;
  carbs: number;
  portionGrams: number | null;
  unit: PortionUnit;
  pieces?: number;
  source: "history" | "catalog";
  customFoodId: string | null;
  useCount: number;
  focus: Focus;
  gap: number;
}): EveningSuggestion & { score: number } {
  const suffix = portionSuffix(
    input.unit === "шт" ? null : input.portionGrams,
    input.unit,
    input.pieces,
  );
  const label = suffix ? `${input.name} · ${suffix}` : input.name;
  const dishName = suffix ? `${input.name}, ${suffix}` : input.name;
  const gained = input.focus === "calories" ? input.calories : input[input.focus];
  const coverage = input.gap > 0 ? Math.min(1, gained / input.gap) : 0;
  const density = gained / Math.max(input.calories, 1);
  const score = coverage * 100 + density * 20 + Math.min(input.useCount, 20) * 0.05;
  return {
    key: `${input.source}:${normalizeFoodName(input.name)}`,
    name: input.name,
    label,
    dishName,
    calories: Math.round(input.calories),
    protein: round1(input.protein),
    fat: round1(input.fat),
    carbs: round1(input.carbs),
    portionGrams: input.portionGrams,
    source: input.source,
    customFoodId: input.customFoodId,
    score,
  };
}

function helpfulGain(focus: Focus, gained: number, gap: number): boolean {
  if (focus === "calories") return gained >= 50;
  const minGain = Math.min(5, Math.max(3, gap * 0.15));
  return gained >= minGain;
}

function fitHistory(
  food: EveningFoodInput,
  remainingKcal: number,
  focus: Focus,
  gap: number,
): (EveningSuggestion & { score: number }) | null {
  const calories = food.calories;
  if (!Number.isFinite(calories) || calories <= 0 || remainingKcal < MIN_REMAINING_KCAL) return null;
  const protein = food.protein ?? 0;
  const fat = food.fat ?? 0;
  const carbs = food.carbs ?? 0;
  const unit: PortionUnit = drinkUnit(food.name) ? "мл" : "г";

  const emit = (scale: number, portionGrams: number | null) => {
    const next = {
      calories: calories * scale,
      protein: protein * scale,
      fat: fat * scale,
      carbs: carbs * scale,
    };
    if (Math.round(next.calories) > remainingKcal) return null;
    if (Math.round(next.calories) < MIN_REMAINING_KCAL) return null;
    const gained = focus === "calories" ? next.calories : next[focus];
    if (!helpfulGain(focus, gained, gap)) return null;
    return buildSuggestion({
      name: food.name.trim(),
      ...next,
      portionGrams,
      unit,
      source: "history",
      customFoodId: food.customFoodId ?? null,
      useCount: food.useCount ?? 1,
      focus,
      gap,
    });
  };

  if (calories <= remainingKcal) {
    return emit(1, food.portionGrams ?? null);
  }

  const baseGrams = food.portionGrams ?? 0;
  if (baseGrams <= 0) return null;
  const factor = remainingKcal / calories;
  if (factor < MIN_SCALE_FACTOR) return null;

  let grams = Math.floor((baseGrams * factor) / 10) * 10;
  while (grams >= 30) {
    const scaled = emit(grams / baseGrams, grams);
    if (scaled) return scaled;
    grams -= 10;
  }
  return null;
}

function fitCatalog(
  food: CatalogFood,
  remainingKcal: number,
  focus: Focus,
  gap: number,
): (EveningSuggestion & { score: number }) | null {
  if (remainingKcal < MIN_REMAINING_KCAL) return null;

  if (food.pieces && food.pieces.length > 0) {
    const piece = [...food.pieces]
      .filter((item) => item.calories <= remainingKcal && item.calories >= MIN_REMAINING_KCAL)
      .sort((a, b) => b.calories - a.calories)[0];
    if (!piece) return null;
    const gained = focus === "calories" ? piece.calories : piece[focus];
    if (!helpfulGain(focus, gained, gap)) return null;
    return buildSuggestion({
      name: food.name,
      calories: piece.calories,
      protein: piece.protein,
      fat: piece.fat,
      carbs: piece.carbs,
      portionGrams: piece.grams,
      unit: "шт",
      pieces: piece.count,
      source: "catalog",
      customFoodId: null,
      useCount: 0,
      focus,
      gap,
    });
  }

  const per100 = food.per100.calories;
  if (per100 <= 0) return null;
  const nutrientPer100 = focus === "calories" ? per100 : food.per100[focus];
  const maxByKcal = (remainingKcal / per100) * 100;
  const need =
    focus === "calories" || nutrientPer100 <= 0
      ? food.max
      : (gap / nutrientPer100) * 100;
  let grams = Math.min(food.max, maxByKcal, need);
  grams = Math.floor(grams / food.step) * food.step;
  if (grams < food.min) {
    if (food.min <= maxByKcal + 0.01) grams = food.min;
    else return null;
  }

  while (grams >= food.min) {
    const scale = grams / 100;
    const calories = food.per100.calories * scale;
    if (Math.round(calories) <= remainingKcal && Math.round(calories) >= MIN_REMAINING_KCAL) {
      const protein = food.per100.protein * scale;
      const fat = food.per100.fat * scale;
      const carbs = food.per100.carbs * scale;
      const gained = focus === "calories" ? calories : focus === "protein" ? protein : focus === "fat" ? fat : carbs;
      if (helpfulGain(focus, gained, gap)) {
        return buildSuggestion({
          name: food.name,
          calories,
          protein,
          fat,
          carbs,
          portionGrams: grams,
          unit: food.unit,
          source: "catalog",
          customFoodId: null,
          useCount: 0,
          focus,
          gap,
        });
      }
    }
    grams -= food.step;
  }
  return null;
}

function mergeHistory(items: EveningFoodInput[]): EveningFoodInput[] {
  const map = new Map<string, EveningFoodInput>();
  for (const item of items) {
    const name = item.name?.trim();
    if (!name || !Number.isFinite(item.calories) || item.calories <= 0) continue;
    const key = normalizeFoodName(name);
    const prev = map.get(key);
    if (!prev) {
      map.set(key, { ...item, name, useCount: item.useCount ?? 1 });
      continue;
    }
    const useCount = Math.max(prev.useCount ?? 0, item.useCount ?? 0);
    if ((item.useCount ?? 0) > (prev.useCount ?? 0)) {
      map.set(key, { ...item, name, useCount, customFoodId: item.customFoodId ?? prev.customFoodId ?? null });
    } else {
      prev.useCount = useCount;
      if (!prev.customFoodId && item.customFoodId) prev.customFoodId = item.customFoodId;
    }
  }
  return [...map.values()];
}

function pickFocus(
  totals: EveningTotals,
  targets: EveningTargets,
  remainingKcal: number,
): { focus: Focus; gap: number } | null {
  if (remainingKcal < MIN_REMAINING_KCAL) return null;
  const macros: Array<{ key: MacroKey; gap: number; severity: number }> = [];
  for (const key of ["protein", "fat", "carbs"] as const) {
    const target = positiveTarget(targets[key]);
    if (target == null) continue;
    const meta = MACRO_META[key];
    const gap = target - totals[key];
    if (gap <= 0 || inBand(totals[key], target, meta.abs, meta.ratio)) continue;
    macros.push({ key, gap, severity: gap / target });
  }
  macros.sort((a, b) => b.severity - a.severity || b.gap - a.gap);
  const top = macros[0];
  if (top) return { focus: top.key, gap: top.gap };
  if (remainingKcal >= 120) return { focus: "calories", gap: remainingKcal };
  return null;
}

export function pickEveningSuggestions(input: {
  totals: EveningTotals;
  targets: EveningTargets;
  history?: EveningFoodInput[] | null;
}): EveningSuggestion[] {
  const calorieTarget = positiveTarget(input.targets.calories);
  if (calorieTarget == null) return [];
  const remainingKcal = calorieTarget - input.totals.calories;
  if (remainingKcal < MIN_REMAINING_KCAL) return [];
  const focus = pickFocus(input.totals, input.targets, remainingKcal);
  if (!focus) return [];

  const history = mergeHistory(input.history ?? [])
    .map((food) => fitHistory(food, remainingKcal, focus.focus, focus.gap))
    .filter((item): item is EveningSuggestion & { score: number } => item != null)
    .sort((a, b) => b.score - a.score || a.name.localeCompare(b.name, "ru"));

  const taken = new Set(history.map((item) => normalizeFoodName(item.name)));
  const catalog = EVENING_CATALOG.map((food) => fitCatalog(food, remainingKcal, focus.focus, focus.gap))
    .filter((item): item is EveningSuggestion & { score: number } => item != null)
    .filter((item) => !taken.has(normalizeFoodName(item.name)))
    .sort((a, b) => b.score - a.score || a.name.localeCompare(b.name, "ru"));

  const picked = [...history, ...catalog].slice(0, 3);
  return picked.map(({ score: _score, ...item }) => item);
}

function macroGapPhrase(name: string, grams: number): string {
  return `До нормы ${name} не хватает ${Math.round(grams)} г`;
}

export function buildEveningPhrases(totals: EveningTotals, targets: EveningTargets): string[] {
  const calorieTarget = positiveTarget(targets.calories);
  const calorieRemain = calorieTarget == null ? null : calorieTarget - totals.calories;
  const caloriesInNorm =
    calorieTarget != null && inBand(totals.calories, calorieTarget, CALORIE_ABS, CALORIE_RATIO);
  const caloriesOver = calorieRemain != null && calorieRemain < 0 && !caloriesInNorm;
  const caloriesShort = calorieRemain != null && calorieRemain > 0 && !caloriesInNorm;

  const waterTarget = positiveTarget(targets.waterMl);
  const waterRemain = waterTarget == null ? 0 : Math.max(0, waterTarget - totals.waterMl);
  const waterShort =
    waterTarget != null &&
    waterRemain > 0 &&
    !inBand(totals.waterMl, waterTarget, WATER_ABS_ML, WATER_RATIO);

  const macroGaps = (["protein", "fat", "carbs"] as const)
    .map((key) => {
      const target = positiveTarget(targets[key]);
      if (target == null) return null;
      const meta = MACRO_META[key];
      const gap = target - totals[key];
      if (gap <= 0 || inBand(totals[key], target, meta.abs, meta.ratio)) return null;
      return { name: meta.name, grams: gap, severity: gap / target };
    })
    .filter((item): item is { name: string; grams: number; severity: number } => item != null)
    .sort((a, b) => b.severity - a.severity || b.grams - a.grams);

  if (caloriesOver) {
    const phrases = ["Калории уже закрыты"];
    if (waterShort) phrases.push(`Воды ещё ${formatWaterLiters(waterRemain)} л`);
    return phrases.slice(0, 2);
  }

  const phrases: string[] = [];
  if (caloriesInNorm && waterShort) {
    phrases.push(`Калории в норме, воды ещё ${formatWaterLiters(waterRemain)} л`);
  }

  const firstMacro = macroGaps[0];
  if (firstMacro && phrases.length < 2) {
    phrases.push(macroGapPhrase(firstMacro.name, firstMacro.grams));
  }

  if (phrases.length < 2 && caloriesShort && calorieRemain != null) {
    phrases.push(`До нормы калорий ещё ${formatInt(calorieRemain)} ккал`);
  }

  if (phrases.length < 2 && waterShort && !phrases.some((line) => line.includes("воды"))) {
    phrases.push(`Воды ещё ${formatWaterLiters(waterRemain)} л`);
  }

  const secondMacro = macroGaps[1];
  if (secondMacro && phrases.length < 2) {
    phrases.push(macroGapPhrase(secondMacro.name, secondMacro.grams));
  }

  if (
    phrases.length === 1 &&
    caloriesInNorm &&
    !phrases.some((line) => line.startsWith("Калории"))
  ) {
    phrases.push("Калории в норме");
  }

  if (phrases.length === 0) {
    return ["День собран: калории, БЖУ и вода в норме"];
  }
  return phrases.slice(0, 2);
}

function ofTarget(eaten: number, target: number | null, suffix: string): string {
  const left = formatInt(eaten);
  if (target == null) return suffix ? `${left} ${suffix}` : left;
  const right = formatInt(target);
  return suffix ? `${left} из ${right} ${suffix}` : `${left} из ${right}`;
}

export function buildEveningStats(totals: EveningTotals, targets: EveningTargets): EveningStat[] {
  const waterTarget = positiveTarget(targets.waterMl);
  return [
    {
      key: "calories",
      label: "Калории",
      short: "Ккал",
      text: ofTarget(totals.calories, positiveTarget(targets.calories), "ккал"),
    },
    {
      key: "protein",
      label: "Белки",
      short: "Б",
      text: ofTarget(totals.protein, positiveTarget(targets.protein), "г"),
    },
    {
      key: "fat",
      label: "Жиры",
      short: "Ж",
      text: ofTarget(totals.fat, positiveTarget(targets.fat), "г"),
    },
    {
      key: "carbs",
      label: "Углеводы",
      short: "У",
      text: ofTarget(totals.carbs, positiveTarget(targets.carbs), "г"),
    },
    {
      key: "water",
      label: "Вода",
      short: "Вода",
      text:
        waterTarget != null
          ? formatWaterOf(totals.waterMl, waterTarget)
          : `${formatWaterLiters(totals.waterMl)} л`,
    },
  ];
}

export function buildEveningDaySummary(input: {
  totals: EveningTotals;
  targets: EveningTargets;
  history?: EveningFoodInput[] | null;
}): EveningSummary {
  return {
    stats: buildEveningStats(input.totals, input.targets),
    phrases: buildEveningPhrases(input.totals, input.targets),
    suggestions: pickEveningSuggestions(input),
  };
}
