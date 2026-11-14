import type { FoodRecognitionResult } from "./food-types";
import { looksLikeDrinkName } from "./portion-unit";

/**
 * Проверка согласованности оценки ИИ перед показом карточки.
 * Калории ≈ 4·Б + 4·У + 9·Ж (±15%), с поправкой на клетчатку (~2 ккал/г,
 * если она уже входит в углеводы) и этанол (~7 ккал/г).
 * Числа с этикетки и из справочников не переписываем — только явный физический предел.
 */

export const ATWATER_TOLERANCE = 0.15;
/** Ниже порога карточки «уточнить» (0.55), без нового поля в API. */
export const LOW_CONFIDENCE_CAP = 0.45;
const KCAL_ABS_SLACK = 5;
const MAX_KCAL_PER_100G = 900;
const SUSPICIOUS_KCAL_PER_100G = 750;
/** Выпечка и десерты реже бывают жирнее этого — ниже общего порога 750. */
const BAKERY_SUSPICIOUS_KCAL_PER_100G = 550;
const DRINK_SUSPICIOUS_KCAL_PER_100ML = 500;
/** Текстовая карточка: предупреждение, не тихая перезапись. У фото остаётся 15%. */
const TEXT_ATWATER_TOLERANCE = 0.25;
const ETHANOL_DENSITY = 0.789;
const KCAL_PER_G_ETHANOL = 7;

export type NutritionIssueCode =
  | "macro-energy"
  | "portion-bounds"
  | "density"
  | "items-sum"
  | "alcohol-gap"
  | "per100-basis"
  | "macro-mass";

const TRUSTED_SOURCES = new Set([
  "openfoodfacts-barcode",
  "openfoodfacts-search",
  "ru-nutrition-table",
  "ru-sku-cache",
  "ru-name-sku",
  "barcode-user",
  "custom-food",
  "off-staple-average",
  "label",
]);

const NON_ALCOHOL_RE = /безалкогол|non-?alcoholic|0[,.]0\s*%|без\s+алкогол/iu;

const ALCOHOL_BANDS: Array<{
  re: RegExp;
  min: number;
  max: number;
  mid: number;
  /** Ниже этой плотности ккал/100 мл цифра похожа на БЖУ без этанола. */
  minPer100: number;
}> = [
  {
    re: /(?:^|[^\p{L}])(?:водк\p{L}*|виски|коньяк\p{L}*|ром|джин|текил\p{L}*|абсент\p{L}*|самогон\p{L}*)(?:[^\p{L}]|$)/iu,
    min: 35,
    max: 45,
    mid: 40,
    minPer100: 100,
  },
  {
    re: /(?:^|[^\p{L}])(?:лик[её]р\p{L}*|настойк\p{L}*)(?:[^\p{L}]|$)/iu,
    min: 15,
    max: 30,
    mid: 20,
    minPer100: 80,
  },
  {
    re: /(?:^|[^\p{L}])(?:вино|вина|вину|вином|вине|шампанск\p{L}*|игрист\p{L}*|портвейн\p{L}*)(?:[^\p{L}]|$)/iu,
    min: 9,
    max: 15,
    mid: 12,
    minPer100: 40,
  },
  {
    re: /(?:^|[^\p{L}])саке(?:[^\p{L}]|$)/iu,
    min: 13,
    max: 17,
    mid: 15,
    minPer100: 40,
  },
  {
    re: /(?:^|[^\p{L}])(?:сидр\p{L}*|медовух\p{L}*)(?:[^\p{L}]|$)/iu,
    min: 4,
    max: 7,
    mid: 5.5,
    minPer100: 25,
  },
  {
    re: /(?:^|[^\p{L}])(?:пив(?:о|а|у|ом|е|ной|ное|ные|ного|ную)|лагер\p{L}*|стаут\p{L}*|портер\p{L}*|эль)(?:[^\p{L}]|$)/iu,
    min: 3,
    max: 8,
    mid: 5,
    minPer100: 25,
  },
];

const CONDIMENT_RE =
  /масло|соус|майонез|кетчуп|горчиц|сметан|мёд|(?:^|[^\p{L}])м[её]д(?:[^\p{L}]|$)|сахар|варень|джем|сироп/iu;
const BITE_RE = /конфет|шоколад|печень|мармелад|зефир|пастил/iu;
const BAKERY_DESSERT_RE =
  /торт|пирожн|пирог|пирож|печень|кекс|круассан|булоч|выпеч|десерт|чизкейк|эклер|пончик|вафл|брауни|маффин|слойк|штрудел|кулич|пряник|профитрол|безе|наполеон|медовик|тирамису|рулет/iu;
const FATTY_RE =
  /масло|сало|(?:^|[^\p{L}])жир(?:[^\p{L}]|$)|майонез|орех|семеч|арахис|миндал|фундук|кешью|грецк|шоколад|халв/iu;
const WATERY_RE = /бульон|огурц|капуст|кабачок|сельдере|редис|арбуз|листов/iu;

type MacroTriple = { protein: number; fat: number; carbs: number };

type AlcoholKcal = { low: number; high: number; mid: number };

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

function isTrustedSource(source: string | undefined): boolean {
  return source != null && TRUSTED_SOURCES.has(source);
}

function isFailedName(name: string | undefined): boolean {
  return /не удалось распознать/i.test(name ?? "");
}

function finiteMacros(item: Pick<FoodRecognitionResult, "protein" | "fat" | "carbs">): MacroTriple | null {
  if (
    item.protein == null ||
    item.fat == null ||
    item.carbs == null ||
    !Number.isFinite(item.protein) ||
    !Number.isFinite(item.fat) ||
    !Number.isFinite(item.carbs)
  ) {
    return null;
  }
  return { protein: item.protein, fat: item.fat, carbs: item.carbs };
}

export function atwaterKcal(protein: number, fat: number, carbs: number): number {
  return 4 * protein + 9 * fat + 4 * carbs;
}

function relativeGap(actual: number, reference: number): number {
  const denom = Math.max(Math.abs(actual), Math.abs(reference), 1);
  return Math.abs(actual - reference) / denom;
}

function closeTo(actual: number, reference: number): boolean {
  if (Math.abs(actual - reference) <= KCAL_ABS_SLACK) return true;
  return relativeGap(actual, reference) <= ATWATER_TOLERANCE;
}

function alcoholBand(name: string | undefined): (typeof ALCOHOL_BANDS)[number] | undefined {
  if (!name || NON_ALCOHOL_RE.test(name)) return undefined;
  return ALCOHOL_BANDS.find((entry) => entry.re.test(name));
}

function alcoholKcal(name: string | undefined, portionMl: number | undefined): AlcoholKcal {
  const none: AlcoholKcal = { low: 0, high: 0, mid: 0 };
  const band = alcoholBand(name);
  if (!band) return none;
  if (!portionMl || portionMl <= 0) {
    return { low: 0, high: Number.POSITIVE_INFINITY, mid: 0 };
  }
  const kcal = (abv: number) => portionMl * (abv / 100) * ETHANOL_DENSITY * KCAL_PER_G_ETHANOL;
  return { low: kcal(band.min), high: kcal(band.max), mid: kcal(band.mid) };
}

function energyRange(
  macros: MacroTriple,
  fiber: number | undefined,
  alcohol: AlcoholKcal,
): { low: number; high: number; point: number } {
  const macro = atwaterKcal(macros.protein, macros.fat, macros.carbs);
  const fiberDown =
    fiber != null && Number.isFinite(fiber)
      ? 2 * Math.min(Math.max(fiber, 0), Math.max(macros.carbs, 0))
      : 0;
  const fiberUp = fiber != null && Number.isFinite(fiber) ? 2 * Math.max(fiber, 0) : 0;
  const low = Math.max(0, macro - fiberDown + alcohol.low);
  const high = macro + fiberUp + alcohol.high;
  const point = Math.max(0, macro - fiberDown + alcohol.mid);
  return { low, high, point };
}

function matchesEnergy(calories: number, range: { low: number; high: number }): boolean {
  if (!Number.isFinite(range.high)) {
    if (calories + KCAL_ABS_SLACK >= range.low) return true;
    return closeTo(calories, range.low);
  }
  if (calories >= range.low && calories <= range.high) return true;
  const nearest = calories < range.low ? range.low : range.high;
  return closeTo(calories, nearest);
}

function portionLimits(name: string, drink: boolean, plate: boolean): { min: number; max: number } {
  if (drink) return { min: 15, max: 3000 };
  if (CONDIMENT_RE.test(name)) return { min: 3, max: 200 };
  if (BITE_RE.test(name)) return { min: 5, max: 400 };
  if (plate) return { min: 30, max: 2500 };
  return { min: 10, max: 1500 };
}

function kcalPer100(calories: number, portion: number): number {
  return (calories * 100) / portion;
}

function macroMass(macros: MacroTriple): number {
  return macros.protein + macros.fat + macros.carbs;
}

function macroMassOverPortion(macros: MacroTriple, portion: number): boolean {
  return macroMass(macros) > portion + 0.5;
}

/** Середина полосы крепости: граммы этанола × 7 ккал/г. 0, если это не алкоголь. */
export function alcoholEnergyKcal(name: string | undefined, portionMl: number | undefined): number {
  if (!portionMl || portionMl <= 0) return 0;
  const value = alcoholKcal(name, portionMl).mid;
  return Number.isFinite(value) ? value : 0;
}

function gapWithin(actual: number, reference: number, tolerance: number): boolean {
  if (Math.abs(actual - reference) <= KCAL_ABS_SLACK) return true;
  return relativeGap(actual, reference) <= tolerance;
}

function matchesEnergyAt(
  calories: number,
  range: { low: number; high: number },
  tolerance: number,
): boolean {
  if (!Number.isFinite(range.high)) {
    if (calories + KCAL_ABS_SLACK >= range.low) return true;
    return gapWithin(calories, range.low, tolerance);
  }
  if (calories >= range.low && calories <= range.high) return true;
  const nearest = calories < range.low ? range.low : range.high;
  return gapWithin(calories, nearest, tolerance);
}

/**
 * Ккал на порцию, а БЖУ как на 100 г (или наоборот). Возвращает правку или null.
 * Та же ветка, что у фото.
 */
function tryPer100Basis(next: FoodRecognitionResult): FoodRecognitionResult | null {
  const portion = next.portionGrams && next.portionGrams > 0 ? next.portionGrams : undefined;
  const macros = finiteMacros(next);
  const alcohol = alcoholKcal(next.dishName, portion);
  if (!(macros && portion && next.calories > 0 && portion > 100)) return null;
  const ratio = portion / 100;
  if (ratio < 1.4) return null;
  const aw = atwaterKcal(macros.protein, macros.fat, macros.carbs);
  const range = energyRange(macros, next.fiber, alcohol);
  if (!(aw > 0 && !matchesEnergy(next.calories, range))) return null;
  const scaledAw = aw * ratio;
  const scaledMass = macroMass(macros) * ratio;
  if (scaledMass <= portion * 1.05 && closeTo(next.calories, scaledAw)) {
    return {
      ...next,
      protein: round1(macros.protein * ratio),
      fat: round1(macros.fat * ratio),
      carbs: round1(macros.carbs * ratio),
      fiber: next.fiber != null ? round1(next.fiber * ratio) : next.fiber,
      sugar: next.sugar != null ? round1(next.sugar * ratio) : next.sugar,
    };
  }
  if (closeTo(next.calories * ratio, aw) && next.calories * ratio <= portion * 9.05) {
    const scaledCalories = Math.round(next.calories * ratio);
    return {
      ...next,
      calories: scaledCalories,
      per100g: alignPer100Calories(next.per100g, scaledCalories, portion),
    };
  }
  return null;
}

/** Калории выглядят как БЖУ без этанола и ниже пола крепости — дописать спирт. */
function tryAlcoholGap(next: FoodRecognitionResult): FoodRecognitionResult | null {
  const portion = next.portionGrams && next.portionGrams > 0 ? next.portionGrams : undefined;
  const macros = finiteMacros(next);
  if (!macros || !(next.calories > 0) || portion == null) return null;
  const alcohol = alcoholKcal(next.dishName, portion);
  const macroOnly = atwaterKcal(macros.protein, macros.fat, macros.carbs);
  const range = energyRange(macros, next.fiber, alcohol);
  if (
    alcohol.mid >= 40 &&
    closeTo(next.calories, macroOnly) &&
    !matchesEnergy(next.calories, range) &&
    kcalPer100(next.calories, portion) < (alcoholBand(next.dishName)?.minPer100 ?? 0)
  ) {
    const corrected = Math.round(range.point);
    if (corrected > next.calories + KCAL_ABS_SLACK) {
      return {
        ...next,
        calories: corrected,
        per100g: alignPer100Calories(next.per100g, corrected, portion),
      };
    }
  }
  return null;
}

function alignPer100Calories(
  per100g: FoodRecognitionResult["per100g"],
  calories: number,
  portion: number | undefined,
): FoodRecognitionResult["per100g"] {
  if (!per100g || !(per100g.calories > 0)) return per100g;
  if (!portion || portion <= 0) {
    return { ...per100g, calories: Math.max(0, Math.round(calories)) };
  }
  return {
    ...per100g,
    calories: Math.max(0, Math.round((calories * 100) / portion)),
  };
}

function capConfidence(confidence: number): number {
  return Math.min(confidence, LOW_CONFIDENCE_CAP);
}

type LeafAssessment = {
  result: FoodRecognitionResult;
  issues: NutritionIssueCode[];
};

function assessLeaf(input: FoodRecognitionResult, plate: boolean): LeafAssessment {
  if (isFailedName(input.dishName)) {
    return { result: input, issues: [] };
  }

  const issues: NutritionIssueCode[] = [];
  let next: FoodRecognitionResult = { ...input };
  let lowConfidence = false;
  const trusted = isTrustedSource(next.source);
  const drink = looksLikeDrinkName(next.dishName, next.brand);
  const name = next.dishName ?? "";
  const portion = next.portionGrams && next.portionGrams > 0 ? next.portionGrams : undefined;

  if (!trusted && portion) {
    const limits = portionLimits(name, drink, plate);
    if (portion < limits.min || portion > limits.max) {
      issues.push("portion-bounds");
      if (next.calories > 0) lowConfidence = true;
    }
  }

  if (trusted) {
    const trustedMacros = finiteMacros(next);
    if (trustedMacros && portion && macroMassOverPortion(trustedMacros, portion)) {
      issues.push("macro-mass");
      lowConfidence = true;
    }
    if (portion && next.calories > portion * 9.05) {
      issues.push("density");
      const capped = Math.round(portion * 9);
      next = {
        ...next,
        calories: capped,
        per100g: alignPer100Calories(next.per100g, capped, portion),
      };
      lowConfidence = true;
    }
    return {
      result: lowConfidence ? { ...next, confidence: capConfidence(next.confidence) } : next,
      issues,
    };
  }

  const per100Fixed = tryPer100Basis(next);
  if (per100Fixed) {
    next = per100Fixed;
    issues.push("per100-basis");
  }

  const macrosNow = finiteMacros(next);
  const alcoholNow = alcoholKcal(name, portion);
  if (macrosNow && next.calories > 0) {
    const range = energyRange(macrosNow, next.fiber, alcoholNow);
    const per100 = portion ? kcalPer100(next.calories, portion) : undefined;
    const impossible =
      (per100 != null && per100 > MAX_KCAL_PER_100G) ||
      (portion != null && next.calories > portion * 9.05);

    if (impossible) {
      issues.push("density");
      const pointPer100 = portion ? kcalPer100(range.point, portion) : range.point;
      const corrected =
        portion && pointPer100 <= MAX_KCAL_PER_100G
          ? Math.round(range.point)
          : portion
            ? Math.round(portion * 9)
            : Math.round(range.point);
      next = {
        ...next,
        calories: Math.max(0, corrected),
        per100g: alignPer100Calories(next.per100g, Math.max(0, corrected), portion),
      };
      if (!portion || pointPer100 > MAX_KCAL_PER_100G) lowConfidence = true;
    } else {
      const alcoholFixed = tryAlcoholGap(next);
      if (alcoholFixed) {
        issues.push("alcohol-gap");
        next = alcoholFixed;
      } else if (!matchesEnergy(next.calories, range)) {
        issues.push("macro-energy");
        lowConfidence = true;
      }
    }
  }

  const macrosAfter = finiteMacros(next);
  if (macrosAfter && portion && macroMassOverPortion(macrosAfter, portion)) {
    if (!issues.includes("macro-mass")) issues.push("macro-mass");
    lowConfidence = true;
  }

  if (portion && next.calories > 0) {
    const per100 = kcalPer100(next.calories, portion);
    const fatty = FATTY_RE.test(name);
    const bakery = BAKERY_DESSERT_RE.test(name);
    const watery = drink || WATERY_RE.test(name);
    const tooDense = bakery
      ? per100 > BAKERY_SUSPICIOUS_KCAL_PER_100G
      : per100 > SUSPICIOUS_KCAL_PER_100G && !fatty;
    if (
      tooDense ||
      (drink && per100 > DRINK_SUSPICIOUS_KCAL_PER_100ML) ||
      (per100 < 8 && !watery && next.calories > 15)
    ) {
      if (!issues.includes("density")) issues.push("density");
      lowConfidence = true;
    }
  }

  if (lowConfidence) {
    next = { ...next, confidence: capConfidence(next.confidence) };
  }

  return { result: next, issues };
}

function sumDefined(
  items: FoodRecognitionResult[],
  pick: (item: FoodRecognitionResult) => number | undefined,
): number | undefined {
  const values: number[] = [];
  for (const item of items) {
    const value = pick(item);
    if (value == null || !Number.isFinite(value)) return undefined;
    values.push(value);
  }
  if (values.length === 0) return undefined;
  return values.reduce((sum, value) => sum + value, 0);
}

function assessItemsSum(result: FoodRecognitionResult): {
  result: FoodRecognitionResult;
  issues: NutritionIssueCode[];
} {
  const items = result.items ?? [];
  if (items.length < 2) return { result, issues: [] };
  if (items.some((item) => (item.calories ?? 0) <= 0)) return { result, issues: [] };

  const issues: NutritionIssueCode[] = [];
  let next = result;
  let lowConfidence = false;

  const calorieSum = Math.round(items.reduce((sum, item) => sum + Math.max(0, item.calories || 0), 0));
  if (Math.abs(calorieSum - next.calories) > 1) {
    const gap = relativeGap(next.calories, calorieSum);
    if (gap > ATWATER_TOLERANCE) {
      issues.push("items-sum");
      lowConfidence = true;
    } else if (gap > 0.02) {
      issues.push("items-sum");
    }
    next = {
      ...next,
      calories: calorieSum,
      per100g: alignPer100Calories(next.per100g, calorieSum, next.portionGrams),
    };
  }

  const macroFields = ["protein", "fat", "carbs", "fiber", "sugar"] as const;
  for (const field of macroFields) {
    const total = sumDefined(items, (item) => item[field]);
    if (total == null) continue;
    const rounded = round1(total);
    const current = next[field];
    if (current == null || Math.abs(current - rounded) > 0.2) {
      if (
        current != null &&
        current > 0 &&
        relativeGap(current, rounded) > ATWATER_TOLERANCE &&
        !issues.includes("items-sum")
      ) {
        issues.push("items-sum");
        lowConfidence = true;
      }
      next = { ...next, [field]: rounded };
    }
  }

  const portionSum = sumDefined(items, (item) => item.portionGrams);
  if (portionSum != null && portionSum > 0) {
    const rounded = Math.round(portionSum);
    if (next.portionGrams == null || Math.abs(next.portionGrams - rounded) > 1) {
      next = { ...next, portionGrams: rounded };
    }
  }

  if (lowConfidence) {
    next = { ...next, confidence: capConfidence(next.confidence) };
  }

  return { result: next, issues };
}

/**
 * Какие нарушения есть в ответе модели до правки.
 * Удобно для офлайн-фикстур: разбор JSON → этот отчёт.
 */
export function explainNutritionConsistency(result: FoodRecognitionResult): NutritionIssueCode[] {
  const plate = (result.items?.length ?? 0) >= 2;
  if (!plate) return assessLeaf(result, false).issues;

  const issues: NutritionIssueCode[] = [];
  for (const item of result.items ?? []) {
    issues.push(...assessLeaf(item, false).issues);
  }
  issues.push(...assessItemsSum(result).issues);
  const limits = portionLimits(result.dishName, looksLikeDrinkName(result.dishName, result.brand), true);
  const portion = result.portionGrams;
  if (
    !isTrustedSource(result.source) &&
    portion &&
    portion > 0 &&
    result.calories > 0 &&
    (portion < limits.min || portion > limits.max)
  ) {
    issues.push("portion-bounds");
  }
  const unique: NutritionIssueCode[] = [];
  for (const issue of issues) {
    if (!unique.includes(issue)) unique.push(issue);
  }
  return unique;
}

/** Поправить однозначные расхождения или опустить confidence. Формат полей не меняется. */
export function applyNutritionConsistency(result: FoodRecognitionResult): FoodRecognitionResult {
  const plate = (result.items?.length ?? 0) >= 2;
  if (!plate) return assessLeaf(result, false).result;

  const originalItems = result.items ?? [];
  const items = originalItems.map((item) => assessLeaf(item, false).result);
  const summed = assessItemsSum({ ...result, items });
  let next = summed.result;
  const itemWasFlagged = items.some(
    (item, index) => item.confidence < originalItems[index]!.confidence,
  );
  if (itemWasFlagged) {
    const minItemConfidence = Math.min(...items.map((item) => item.confidence));
    if (minItemConfidence < next.confidence) {
      next = { ...next, confidence: minItemConfidence };
    }
  }

  const limits = portionLimits(next.dishName, looksLikeDrinkName(next.dishName, next.brand), true);
  const portion = next.portionGrams;
  if (
    !isTrustedSource(next.source) &&
    portion &&
    portion > 0 &&
    next.calories > 0 &&
    (portion < limits.min || portion > limits.max)
  ) {
    next = { ...next, confidence: capConfidence(next.confidence) };
  }

  return next;
}

export type TextMealNutrition = {
  name: string;
  kcal?: number;
  protein?: number;
  fat?: number;
  carbs?: number;
  fiber?: number;
  grams?: number;
};

export type TextMealReview = {
  kcal?: number;
  protein?: number;
  fat?: number;
  carbs?: number;
  fiber?: number;
  /** Что сработало: и правка, и предупреждение. */
  codes: NutritionIssueCode[];
  /** Текст для карточки. Пусто, если числа поправили и расхождений не осталось. */
  warning: string | null;
};

const TEXT_WARNING: Partial<Record<NutritionIssueCode, string>> = {
  "macro-mass": "Масса БЖУ больше порции",
  density: "Слишком много ккал на 100 г",
  "macro-energy": "Ккал не сходятся с БЖУ",
};

function textWarningCodes(next: FoodRecognitionResult): NutritionIssueCode[] {
  const codes: NutritionIssueCode[] = [];
  const name = next.dishName ?? "";
  const portion = next.portionGrams && next.portionGrams > 0 ? next.portionGrams : undefined;
  const macros = finiteMacros(next);
  const drink = looksLikeDrinkName(name, next.brand);
  if (macros && portion && macroMassOverPortion(macros, portion)) codes.push("macro-mass");
  if (portion && next.calories > 0) {
    const per100 = kcalPer100(next.calories, portion);
    const fatty = FATTY_RE.test(name);
    if (!drink && !fatty && per100 > SUSPICIOUS_KCAL_PER_100G) codes.push("density");
  }
  if (macros && next.calories > 0) {
    const range = energyRange(macros, next.fiber, alcoholKcal(name, portion));
    if (!matchesEnergyAt(next.calories, range, TEXT_ATWATER_TOLERANCE)) codes.push("macro-energy");
  }
  return codes;
}

/**
 * Санитарная проверка текста. 100 г вместо названной порции и дыру этанола правим.
 * Массу БЖУ, плотность и Атуотер >25% только помечаем.
 */
export function reviewTextMealNutrition(input: TextMealNutrition): TextMealReview {
  const portion = input.grams && input.grams > 0 ? input.grams : undefined;
  let next: FoodRecognitionResult = {
    dishName: input.name,
    calories: typeof input.kcal === "number" && input.kcal > 0 ? input.kcal : 0,
    protein: input.protein,
    fat: input.fat,
    carbs: input.carbs,
    fiber: input.fiber,
    portionGrams: portion,
    confidence: 0.8,
  };
  const codes: NutritionIssueCode[] = [];
  const per100Fixed = tryPer100Basis(next);
  if (per100Fixed) {
    next = per100Fixed;
    codes.push("per100-basis");
  }
  const alcoholFixed = tryAlcoholGap(next);
  if (alcoholFixed) {
    next = alcoholFixed;
    codes.push("alcohol-gap");
  }
  const warnings = textWarningCodes(next);
  for (const code of warnings) {
    if (!codes.includes(code)) codes.push(code);
  }
  const warningText = warnings.map((code) => TEXT_WARNING[code]).filter(Boolean);
  return {
    kcal: next.calories > 0 ? next.calories : input.kcal,
    protein: next.protein,
    fat: next.fat,
    carbs: next.carbs,
    fiber: next.fiber,
    codes,
    warning: warningText.length ? `${warningText.join(". ")}. Проверьте цифры.` : null,
  };
}
