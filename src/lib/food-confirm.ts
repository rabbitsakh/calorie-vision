/**
 * Одна проверка карточки еды для чата, фото и штрихкода.
 * Неизвестная порция остаётся пустой: 100 г сами не подставляются.
 */

import type { AssistantActions } from "@/lib/admin-assistant";
import { mealTypeKeyFromLabel, type MealTypeKey } from "@/lib/assistant-meal-time";
import type { FoodRecognitionResult } from "@/lib/food-types";
import { parseMealTimeHHMM } from "@/lib/assistant-meal-time";
import { dateKeyAndTimeToIso } from "@/lib/dates";
import type { SaveMealInput } from "@/lib/save-meal";
import { splitQuickPortion, type QuickMeal } from "@/lib/quick-log";

export type FoodConfirmSource = "chat" | "photo" | "barcode";
export type FoodConfirmUnit = "г" | "мл" | "шт";
export type FoodConfirmSlot = MealTypeKey;

export type FoodConfirmPer100 = {
  calories: number;
  protein?: number;
  fat?: number;
  carbs?: number;
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

/** Первая явная порция не пересчитывает ккал от выдуманных 100 г. Дальше — от per100 или пропорционально. */
export function withFoodConfirmGrams(dish: FoodConfirmDish, grams: number | null): FoodConfirmDish {
  if (grams == null || !Number.isFinite(grams) || grams <= 0) {
    return { ...dish, grams: null };
  }
  const next = Math.round(grams);
  if (dish.per100 && dish.per100.calories > 0) {
    const ratio = next / 100;
    return {
      ...dish,
      grams: next,
      kcal: Math.max(0, Math.round(dish.per100.calories * ratio)),
      protein: scaleOpt(dish.per100.protein, ratio),
      fat: scaleOpt(dish.per100.fat, ratio),
      carbs: scaleOpt(dish.per100.carbs, ratio),
    };
  }
  if (dish.grams != null && dish.grams > 0 && dish.kcal != null) {
    const ratio = next / dish.grams;
    return {
      ...dish,
      grams: next,
      kcal: Math.max(0, Math.round(dish.kcal * ratio)),
      protein: scaleOpt(dish.protein, ratio),
      fat: scaleOpt(dish.fat, ratio),
      carbs: scaleOpt(dish.carbs, ratio),
      fiber: scaleOpt(dish.fiber, ratio),
      sugar: scaleOpt(dish.sugar, ratio),
    };
  }
  return { ...dish, grams: next };
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
        error: `Укажите порцию у «${name}». 100 г сами не подставим.`,
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
  return {
    name: (named.base || meal.name).trim(),
    grams,
    unit,
    kcal: typeof meal.kcal === "number" && Number.isFinite(meal.kcal) ? Math.round(meal.kcal) : null,
    protein: typeof meal.protein === "number" ? meal.protein : null,
    fat: typeof meal.fat === "number" ? meal.fat : null,
    carbs: typeof meal.carbs === "number" ? meal.carbs : null,
    mealSlot: slotFromNote(meal.note, meal.mealSlot ?? null),
    time: meal.time ?? null,
    unparsed: meal.unparsed,
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
  },
  source: FoodConfirmSource = "photo",
): FoodConfirmDish {
  const grams = draft.portionGrams && draft.portionGrams > 0 ? Math.round(draft.portionGrams) : null;
  return {
    name: draft.dishName?.trim() || "",
    grams,
    unit: "г",
    kcal:
      draft.calories != null && Number.isFinite(draft.calories) && draft.calories > 0
        ? Math.round(draft.calories)
        : null,
    protein: draft.protein ?? null,
    fat: draft.fat ?? null,
    carbs: draft.carbs ?? null,
    fiber: draft.fiber ?? null,
    sugar: draft.sugar ?? null,
    mealSlot: draft.mealType ?? null,
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
 * Иначе порция пустая: калории показываем на 100 г, 100 г сами не пишем.
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
