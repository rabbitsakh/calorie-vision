/**
 * Одна проверка карточки еды для чата, фото и штрихкода.
 * Неизвестная порция остаётся пустой.
 */

import type { AssistantActions } from "@/lib/admin-assistant";
import { mealTypeKeyFromLabel, type MealTypeKey } from "@/lib/assistant-meal-time";
import type { FoodRecognitionResult } from "@/lib/food-types";
import { parseMealTimeHHMM } from "@/lib/assistant-meal-time";
import { dateKeyAndTimeToIso } from "@/lib/dates";
import type { SaveMealInput } from "@/lib/save-meal";
import { splitQuickPortion, type QuickMeal } from "@/lib/quick-log";

export const FOOD_CONFIRM_PORTION_SKIM = "проверь порцию.";

export type FoodConfirmSource = "chat" | "photo" | "barcode";
export type FoodConfirmUnit = "г" | "мл" | "шт";
export type FoodConfirmSlot = MealTypeKey;

export type FoodConfirmPer100 = {
  calories: number;
  protein?: number;
  fat?: number;
  carbs?: number;
};

/**
 * Неизменная база пересчёта. Порция на экране от неё считается каждый раз заново,
 * а не от уже пересчитанного предыдущего ввода.
 * per100 — плотность на 100 г/мл. amount 0 — числа ещё не привязаны к весу.
 */
export type FoodConfirmNutritionBase = {
  amount: number;
  kcal: number;
  protein: number | null;
  fat: number | null;
  carbs: number | null;
  fiber: number | null;
  sugar: number | null;
  per100: boolean;
};

export type FoodConfirmDish = {
  name: string;
  grams: number | null;
  unit: FoodConfirmUnit;
  kcal: number | null;
  protein: number | null;
  fat: number | null;
  carbs: number | null;
  fiber?: number | null;
  sugar?: number | null;
  mealSlot: FoodConfirmSlot | null;
  /** HH:MM в поясе пользователя, если модель его назвала. */
  time?: string | null;
  unparsed?: boolean;
  per100?: FoodConfirmPer100 | null;
  /** Снимок для пересчёта порции. Не пишется в дневник. */
  nutritionBase?: FoodConfirmNutritionBase | null;
  /** estimate — типовая строка справочника. unknown — состав не найден, нули не показываем. */
  nutritionBasis?: "estimate" | "unknown";
  /** Санитарная проверка текста: цифры оставлены, на карточке предупреждение. */
  nutritionWarning?: string;
  source: FoodConfirmSource;
  barcode?: string;
  brand?: string;
  imagePath?: string;
  recognitionSource?: string;
  photoKind?: string;
  confidence?: number;
};

const ALCOHOL_NAME_RE =
  /пив|вино|водк|виски|коньяк|сидр|шампан|ром\b|ликёр|ликер|джин|саке|медовух/i;

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

function scaleOpt(value: number | null | undefined, ratio: number): number | null {
  if (value == null || !Number.isFinite(value)) return value ?? null;
  return round1(value * ratio);
}

function atwater(protein: number, fat: number, carbs: number): number {
  return 4 * protein + 9 * fat + 4 * carbs;
}

export function foodConfirmNutritionNote(dish: Pick<FoodConfirmDish, "nutritionBasis">): string | null {
  if (dish.nutritionBasis === "unknown") return "КБЖУ не определены — нужно уточнить";
  if (dish.nutritionBasis === "estimate") return "Типовая оценка по справочнику";
  return null;
}

export function foodConfirmMissingPortionError(name: string): string {
  return `Укажите порцию у «${name}».`;
}

export function foodConfirmEnergyWarning(dish: FoodConfirmDish): string | null {
  if (dish.kcal == null || dish.kcal <= 0) return null;
  if (ALCOHOL_NAME_RE.test(dish.name)) return null;
  const protein = dish.protein ?? 0;
  const fat = dish.fat ?? 0;
  const carbs = dish.carbs ?? 0;
  if (protein + fat + carbs < 0.5) return null;
  const expected = atwater(protein, fat, carbs);
  if (!(expected > 0)) return null;
  const ratio = dish.kcal / expected;
  if (ratio >= 0.75 && ratio <= 1.33) return null;
  return `Ккал не сходятся с БЖУ: в поле ${Math.round(dish.kcal)}, по БЖУ около ${Math.round(expected)}`;
}

function numOrNull(value: number | null | undefined): number | null {
  if (value == null || !Number.isFinite(value)) return null;
  return value;
}

function deriveFoodConfirmBase(dish: FoodConfirmDish): FoodConfirmNutritionBase {
  if (dish.per100 && dish.per100.calories > 0) {
    return {
      amount: 100,
      kcal: dish.per100.calories,
      protein: numOrNull(dish.per100.protein),
      fat: numOrNull(dish.per100.fat),
      carbs: numOrNull(dish.per100.carbs),
      fiber: numOrNull(dish.fiber),
      sugar: numOrNull(dish.sugar),
      per100: true,
    };
  }
  if (dish.grams != null && dish.grams > 0 && dish.kcal != null) {
    return {
      amount: Math.round(dish.grams),
      kcal: dish.kcal,
      protein: numOrNull(dish.protein),
      fat: numOrNull(dish.fat),
      carbs: numOrNull(dish.carbs),
      fiber: numOrNull(dish.fiber),
      sugar: numOrNull(dish.sugar),
      per100: false,
    };
  }
  return {
    amount: 0,
    kcal: dish.kcal ?? 0,
    protein: numOrNull(dish.protein),
    fat: numOrNull(dish.fat),
    carbs: numOrNull(dish.carbs),
    fiber: numOrNull(dish.fiber),
    sugar: numOrNull(dish.sugar),
    per100: false,
  };
}

function lockedFoodConfirmBase(dish: FoodConfirmDish): FoodConfirmNutritionBase {
  return dish.nutritionBase ?? deriveFoodConfirmBase(dish);
}

/** «1»→«15»→«150» и стирание до «15» — всё ещё набор первой порции, не новый вес. */
function isPortionTypingContinuation(previous: number | null, next: number): boolean {
  if (previous == null || !(previous > 0)) return true;
  const prev = String(Math.round(previous));
  const nxt = String(next);
  return nxt.startsWith(prev) || prev.startsWith(nxt);
}

function applyFoodConfirmScale(
  dish: FoodConfirmDish,
  base: FoodConfirmNutritionBase,
  grams: number,
): FoodConfirmDish {
  const ratio = grams / base.amount;
  const next: FoodConfirmDish = {
    ...dish,
    grams,
    nutritionBase: base,
    kcal: Math.max(0, Math.round(base.kcal * ratio)),
    protein: scaleOpt(base.protein, ratio),
    fat: scaleOpt(base.fat, ratio),
    carbs: scaleOpt(base.carbs, ratio),
  };
  if (!base.per100) {
    next.fiber = scaleOpt(base.fiber, ratio);
    next.sugar = scaleOpt(base.sugar, ratio);
  }
  return next;
}

/**
 * Порция пустая, а числа известны только на 100 г/мл — в полях показываем плотность, не съеденное.
 */
export function foodConfirmShowsPer100(dish: FoodConfirmDish): boolean {
  if (dish.grams != null && dish.grams > 0) return false;
  if (dish.nutritionBase && !dish.nutritionBase.per100) return false;
  return Boolean(dish.per100 && dish.per100.calories > 0);
}

export function foodConfirmVisibleNumber(
  dish: FoodConfirmDish,
  key: "kcal" | "protein" | "fat" | "carbs",
): number | null {
  if (foodConfirmShowsPer100(dish) && dish.per100) {
    if (key === "kcal") return dish.per100.calories;
    const fromDensity = dish.per100[key];
    if (fromDensity != null && Number.isFinite(fromDensity)) return fromDensity;
  }
  const value = dish[key];
  return value != null && Number.isFinite(value) ? value : null;
}

/** Подпись у КБЖУ: плотность, пока порции нет, и итог, когда граммы уже введены. */
export function foodConfirmMacroBasisLabel(dish: FoodConfirmDish): string | null {
  const unit = dish.unit === "мл" ? "мл" : "г";
  if (foodConfirmShowsPer100(dish)) return `на 100 ${unit}`;
  if (
    dish.grams != null &&
    dish.grams > 0 &&
    dish.per100 &&
    dish.per100.calories > 0 &&
    dish.nutritionBase?.per100 !== false
  ) {
    return "на порцию";
  }
  return null;
}

/**
 * Пересчёт от неизменной базы.
 * Плотность на 100 г — каждый ввод делится на 100, а не на предыдущую цифру.
 * Пустая и нулевая порция базу не стирают.
 * Без плотности первая порция (включая «1»→«15»→«150») не выдумывает 100 г:
 * ккал остаются как есть, пока вес не заменят на другое число.
 */
export function withFoodConfirmGrams(dish: FoodConfirmDish, grams: number | null): FoodConfirmDish {
  const base = lockedFoodConfirmBase(dish);
  if (grams == null || !Number.isFinite(grams) || grams <= 0) {
    return { ...dish, grams: null, nutritionBase: base };
  }
  const next = Math.round(grams);
  if (base.per100 || base.amount > 0) {
    const locked: FoodConfirmNutritionBase = base.per100 ? { ...base, amount: 100, per100: true } : base;
    return applyFoodConfirmScale(dish, locked, next);
  }
  if (isPortionTypingContinuation(dish.grams, next) || (!(base.kcal > 0) && dish.kcal == null)) {
    return { ...dish, grams: next, nutritionBase: base };
  }
  const locked: FoodConfirmNutritionBase = {
    ...base,
    amount: dish.grams != null && dish.grams > 0 ? Math.round(dish.grams) : next,
    kcal: dish.kcal ?? base.kcal,
    protein: numOrNull(dish.protein),
    fat: numOrNull(dish.fat),
    carbs: numOrNull(dish.carbs),
    fiber: numOrNull(dish.fiber),
    sugar: numOrNull(dish.sugar),
    per100: false,
  };
  return applyFoodConfirmScale(dish, locked, next);
}

/** Строка из поля «Порция»: пусто и ноль не ломают базу. */
export function foodConfirmPortionInput(dish: FoodConfirmDish, raw: string): FoodConfirmDish {
  const trimmed = raw.trim().replace(",", ".");
  if (!trimmed) return withFoodConfirmGrams(dish, null);
  const grams = Number(trimmed);
  if (!Number.isFinite(grams) || grams <= 0) return withFoodConfirmGrams(dish, null);
  return withFoodConfirmGrams(dish, grams);
}

/**
 * Ручная правка ккал/БЖУ. База снимается один раз с текущего ненулевого веса.
 * Дальше порция масштабирует этот снимок, а не каждое промежуточное поле.
 */
export function rebaseFoodConfirmMacros(
  dish: FoodConfirmDish,
  patch: Partial<Pick<FoodConfirmDish, "kcal" | "protein" | "fat" | "carbs" | "fiber" | "sugar">>,
): FoodConfirmDish {
  const current = {
    kcal: foodConfirmVisibleNumber(dish, "kcal"),
    protein: foodConfirmVisibleNumber(dish, "protein"),
    fat: foodConfirmVisibleNumber(dish, "fat"),
    carbs: foodConfirmVisibleNumber(dish, "carbs"),
    fiber: numOrNull(dish.fiber),
    sugar: numOrNull(dish.sugar),
  };
  const merged = { ...current, ...patch };
  const amount = dish.grams != null && dish.grams > 0 ? Math.round(dish.grams) : 0;
  const base: FoodConfirmNutritionBase = {
    amount,
    kcal: merged.kcal ?? 0,
    protein: numOrNull(merged.protein),
    fat: numOrNull(merged.fat),
    carbs: numOrNull(merged.carbs),
    fiber: numOrNull(merged.fiber),
    sugar: numOrNull(merged.sugar),
    per100: false,
  };
  return {
    ...dish,
    kcal: merged.kcal,
    protein: merged.protein,
    fat: merged.fat,
    carbs: merged.carbs,
    fiber: merged.fiber,
    sugar: merged.sugar,
    unparsed: false,
    nutritionBasis: undefined,
    nutritionWarning: undefined,
    per100: null,
    nutritionBase: base,
  };
}

export function prepareFoodConfirmSave(dishes: FoodConfirmDish[]):
  | { ok: true; ready: FoodConfirmDish[]; skipped: number; warnings: string[] }
  | { ok: false; error: string; warnings: string[] } {
  const warnings: string[] = [];
  const ready: FoodConfirmDish[] = [];
  let skipped = 0;
  for (const dish of dishes) {
    const name = dish.name.trim();
    if (!name) {
      skipped += 1;
      continue;
    }
    if (dish.unparsed && !(typeof dish.kcal === "number" && dish.kcal > 0)) {
      skipped += 1;
      continue;
    }
    if (dish.grams == null || dish.grams <= 0) {
      return {
        ok: false,
        error: foodConfirmMissingPortionError(name),
        warnings,
      };
    }
    if (dish.nutritionBasis === "unknown" && !(typeof dish.kcal === "number" && dish.kcal > 0)) {
      return {
        ok: false,
        error: `КБЖУ у «${name}» не определены — уточните калории`,
        warnings,
      };
    }
    if (dish.kcal == null || !Number.isFinite(dish.kcal) || dish.kcal < 0) {
      return { ok: false, error: `Укажите калории у «${name}»`, warnings };
    }
    const warning = foodConfirmEnergyWarning(dish);
    if (warning) warnings.push(`${name}: ${warning}`);
    ready.push({ ...dish, name });
  }
  if (!ready.length) {
    return { ok: false, error: "Нет блюд для записи", warnings };
  }
  return { ok: true, ready, skipped, warnings };
}

export function foodConfirmToSaveInputs(
  dishes: FoodConfirmDish[],
  date: string,
  eatenAt?: string,
): SaveMealInput[] {
  return dishes.map((dish) => {
    const unit = dish.unit === "мл" ? "мл" : dish.unit === "шт" ? "шт" : "г";
    const base = dish.name.trim();
    const named = splitQuickPortion(base);
    const dishName =
      named.grams == null && dish.grams != null
        ? `${named.base.trim() || base} (${dish.grams} ${unit})`.slice(0, 200)
        : base.slice(0, 200);
    const clock = parseMealTimeHHMM(dish.time ?? undefined);
    const rowEatenAt = eatenAt ?? (clock ? dateKeyAndTimeToIso(date, clock) : null);
    return {
      date,
      dishName,
      calories: Math.round(dish.kcal ?? 0),
      ...(dish.protein != null ? { protein: dish.protein } : {}),
      ...(dish.fat != null ? { fat: dish.fat } : {}),
      ...(dish.carbs != null ? { carbs: dish.carbs } : {}),
      ...(dish.fiber != null ? { fiber: dish.fiber } : {}),
      ...(dish.sugar != null ? { sugar: dish.sugar } : {}),
      ...(dish.unit !== "шт" && dish.grams != null ? { portionGrams: dish.grams } : {}),
      ...(dish.mealSlot ? { mealType: dish.mealSlot } : {}),
      ...(rowEatenAt ? { eatenAt: rowEatenAt } : {}),
      ...(dish.confidence != null ? { confidence: dish.confidence } : {}),
      ...(dish.imagePath ? { imagePath: dish.imagePath } : {}),
      ...(dish.barcode ? { barcode: dish.barcode } : {}),
      ...(dish.brand ? { brand: dish.brand } : {}),
      recognitionSource:
        dish.recognitionSource ??
        (dish.source === "chat" ? "assistant" : dish.source === "barcode" ? "barcode" : "photo"),
      ...(dish.photoKind ? { photoKind: dish.photoKind } : {}),
    };
  });
}

function slotFromNote(note: string | undefined, mealSlot: FoodConfirmSlot | null | undefined): FoodConfirmSlot | null {
  if (mealSlot) return mealSlot;
  return mealTypeKeyFromLabel(
    note === "завтрак" || note === "обед" || note === "ужин" || note === "перекус" ? note : null,
  );
}

export function foodConfirmFromQuickMeal(meal: QuickMeal, source: FoodConfirmSource = "chat"): FoodConfirmDish {
  const named = splitQuickPortion(meal.name);
  const grams =
    typeof meal.grams === "number" && meal.grams > 0
      ? Math.round(meal.grams)
      : named.grams != null && named.grams > 0
        ? named.grams
        : null;
  const unit: FoodConfirmUnit =
    meal.unit === "мл" || meal.unit === "шт" ? meal.unit : named.unit === "мл" && meal.grams == null ? "мл" : "г";
  const unknown = meal.nutritionBasis === "unknown";
  const macro = (value: number | undefined) =>
    unknown || typeof value !== "number" || !Number.isFinite(value) ? null : value;
  return {
    name: (named.base || meal.name).trim(),
    grams,
    unit,
    kcal: unknown
      ? null
      : typeof meal.kcal === "number" && Number.isFinite(meal.kcal)
        ? Math.round(meal.kcal)
        : null,
    protein: macro(meal.protein),
    fat: macro(meal.fat),
    carbs: macro(meal.carbs),
    mealSlot: slotFromNote(meal.note, meal.mealSlot ?? null),
    time: meal.time ?? null,
    unparsed: meal.unparsed,
    per100: meal.per100 ?? null,
    nutritionBasis: meal.nutritionBasis,
    nutritionWarning: meal.nutritionWarning,
    source,
  };
}

export function foodConfirmFromQuickMeals(meals: QuickMeal[], source: FoodConfirmSource = "chat"): FoodConfirmDish[] {
  return meals.map((meal) => foodConfirmFromQuickMeal(meal, source));
}

export function foodConfirmFromRecognition(
  item: FoodRecognitionResult,
  source: FoodConfirmSource,
  mealSlot: FoodConfirmSlot | null = null,
): FoodConfirmDish {
  const grams = item.portionGrams && item.portionGrams > 0 ? Math.round(item.portionGrams) : null;
  const per100 =
    item.per100g && item.per100g.calories > 0
      ? {
          calories: item.per100g.calories,
          protein: item.per100g.protein,
          fat: item.per100g.fat,
          carbs: item.per100g.carbs,
        }
      : null;
  return {
    name: item.dishName?.trim() || "",
    grams,
    unit: /пив|молок|кефир|сок|вода|напит|мл/i.test(item.dishName) ? "мл" : "г",
    kcal: Number.isFinite(item.calories) && item.calories > 0 ? Math.round(item.calories) : null,
    protein: item.protein ?? null,
    fat: item.fat ?? null,
    carbs: item.carbs ?? null,
    fiber: item.fiber ?? null,
    sugar: item.sugar ?? null,
    mealSlot,
    per100,
    source,
    barcode: item.barcode,
    brand: item.brand,
    recognitionSource: item.source,
    photoKind: item.photoKind,
    confidence: item.confidence,
  };
}

export function foodConfirmFromPhotoDraft(
  draft: {
    dishName: string;
    calories?: number;
    protein?: number;
    fat?: number;
    carbs?: number;
    fiber?: number;
    sugar?: number;
    portionGrams?: number;
    mealType?: FoodConfirmSlot | null;
    confidence?: number;
    photoKind?: string;
    barcode?: string;
    brand?: string;
    recognitionSource?: string;
    per100g?: FoodConfirmPer100 | null;
  },
  source: FoodConfirmSource = "photo",
): FoodConfirmDish {
  const grams = draft.portionGrams && draft.portionGrams > 0 ? Math.round(draft.portionGrams) : null;
  const density =
    draft.per100g && draft.per100g.calories > 0
      ? {
          calories: draft.per100g.calories,
          protein: draft.per100g.protein,
          fat: draft.per100g.fat,
          carbs: draft.per100g.carbs,
        }
      : null;
  // Порция уже есть — база это итог на неё. Плотность подставляем только когда веса нет.
  const per100 = grams == null ? density : null;
  return {
    name: draft.dishName?.trim() || "",
    grams,
    unit: "г",
    kcal: per100
      ? null
      : draft.calories != null && Number.isFinite(draft.calories) && draft.calories > 0
        ? Math.round(draft.calories)
        : null,
    protein: per100 ? null : (draft.protein ?? null),
    fat: per100 ? null : (draft.fat ?? null),
    carbs: per100 ? null : (draft.carbs ?? null),
    fiber: draft.fiber ?? null,
    sugar: draft.sugar ?? null,
    mealSlot: draft.mealType ?? null,
    per100,
    source: draft.photoKind === "barcode" || draft.barcode ? "barcode" : source,
    barcode: draft.barcode,
    brand: draft.brand,
    recognitionSource: draft.recognitionSource,
    photoKind: draft.photoKind,
    confidence: draft.confidence,
  };
}

/**
 * Порция после поиска или замены продукта.
 * Явные граммы пользователя, нетто и порция не равная 100 г сохраняются.
 * Иначе порция пустая: калории остаются плотностью на 100 г, в порцию их не пишем.
 */
export function portionAfterProductLookup(input: {
  currentGrams?: number | null;
  originalGrams?: number | null;
  lookedGrams?: number | null;
}): number | null {
  if (input.currentGrams != null && input.currentGrams > 0) return Math.round(input.currentGrams);
  if (input.originalGrams != null && input.originalGrams > 0 && input.originalGrams !== 100) {
    return Math.round(input.originalGrams);
  }
  if (input.lookedGrams != null && input.lookedGrams > 0 && input.lookedGrams !== 100) {
    return Math.round(input.lookedGrams);
  }
  return null;
}

/** Плотность на 100 г из ответа поиска, если порцию в карточку класть нельзя. */
export function per100FromLookup(looked: {
  calories: number;
  protein?: number;
  fat?: number;
  carbs?: number;
  fiber?: number;
  sugar?: number;
  portionGrams?: number;
}): FoodConfirmPer100 {
  const portion = looked.portionGrams && looked.portionGrams > 0 ? looked.portionGrams : 100;
  const ratio = 100 / portion;
  const scale = (value: number | undefined) =>
    value == null || !Number.isFinite(value) ? undefined : Math.round(value * ratio * 10) / 10;
  return {
    calories: Math.max(0, Math.round((Number(looked.calories) || 0) * ratio)),
    protein: scale(looked.protein),
    fat: scale(looked.fat),
    carbs: scale(looked.carbs),
  };
}

export function foodConfirmMealsOf(actions: AssistantActions | null | undefined): FoodConfirmDish[] {
  return foodConfirmFromQuickMeals(actions?.meals ?? [], "chat");
}
