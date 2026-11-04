/**
 * Строгая схема блюда из чата. Regex-разбор прозы — только запас, если схема не сошлась.
 * Граммы не выдумываются: null / 0 значит «порция не названа», а не 100 г.
 */

import type { AssistantActions } from "@/lib/admin-assistant";
import { isNutrientLabelName } from "@/lib/assistant-repair";
import { mealNoteFromTypeKey, type MealTypeKey } from "@/lib/assistant-meal-time";

export type MealSlot = MealTypeKey;

export type StructuredMeal = {
  name: string;
  grams: number | null;
  unit: "г" | "мл" | "шт" | null;
  kcal: number;
  protein: number;
  fat: number;
  carbs: number;
  mealSlot: MealSlot | null;
};

const SLOTS = new Set<MealSlot>(["BREAKFAST", "LUNCH", "DINNER", "SNACK"]);

const SLOT_ALIAS: Record<string, MealSlot> = {
  BREAKFAST: "BREAKFAST",
  LUNCH: "LUNCH",
  DINNER: "DINNER",
  SNACK: "SNACK",
  ЗАВТРАК: "BREAKFAST",
  ОБЕД: "LUNCH",
  УЖИН: "DINNER",
  ПЕРЕКУС: "SNACK",
};

function finite(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value.trim().replace(",", "."));
    if (Number.isFinite(parsed)) return parsed;
  }
  return undefined;
}

function cleanName(raw: string): string {
  return raw
    .replace(/\s*\(учтено полностью\)\s*/giu, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 120);
}

function readUnit(value: unknown): "г" | "мл" | "шт" | null | undefined {
  if (value === null || value === "") return null;
  if (typeof value !== "string") return undefined;
  const unit = value.trim().toLowerCase();
  if (unit === "г" || unit === "g" || unit === "гр") return "г";
  if (unit === "мл" || unit === "ml") return "мл";
  if (unit === "шт" || unit === "pcs" || unit === "pc") return "шт";
  return undefined;
}

function readSlot(value: unknown): MealSlot | null | undefined {
  if (value === null || value === "") return null;
  if (typeof value !== "string") return undefined;
  return SLOT_ALIAS[value.trim().toUpperCase()] ?? undefined;
}

function readMeal(row: unknown): StructuredMeal | null {
  if (!row || typeof row !== "object") return null;
  const item = row as Record<string, unknown>;
  if (!("grams" in item) || !("unit" in item) || !("mealSlot" in item)) return null;
  if (!("protein" in item) || !("fat" in item) || !("carbs" in item) || !("kcal" in item)) {
    return null;
  }
  const name = typeof item.name === "string" ? cleanName(item.name) : "";
  if (name.length < 2 || isNutrientLabelName(name) || /^исключено(?:\s|$)/iu.test(name)) return null;

  const gramsRaw = finite(item.grams);
  let grams: number | null;
  if (item.grams === null || gramsRaw === 0) grams = null;
  else if (gramsRaw !== undefined && gramsRaw > 0 && gramsRaw <= 5000) grams = Math.round(gramsRaw);
  else return null;

  const unit = readUnit(item.unit);
  if (unit === undefined) return null;
  if (grams != null && unit == null) return null;

  const kcalRaw = finite(item.kcal);
  if (kcalRaw === undefined || kcalRaw < 0 || kcalRaw > 9000) return null;
  const protein = finite(item.protein);
  const fat = finite(item.fat);
  const carbs = finite(item.carbs);
  if (
    protein === undefined ||
    fat === undefined ||
    carbs === undefined ||
    protein < 0 ||
    fat < 0 ||
    carbs < 0 ||
    protein > 500 ||
    fat > 500 ||
    carbs > 500
  ) {
    return null;
  }
  const mealSlot = readSlot(item.mealSlot);
  if (mealSlot === undefined || (mealSlot != null && !SLOTS.has(mealSlot))) return null;

  return {
    name,
    grams,
    unit,
    kcal: Math.round(kcalRaw),
    protein: Math.round(protein * 10) / 10,
    fat: Math.round(fat * 10) / 10,
    carbs: Math.round(carbs * 10) / 10,
    mealSlot,
  };
}

function unwrap(raw: unknown): unknown {
  if (typeof raw === "string") {
    const trimmed = raw
      .trim()
      .replace(/^```(?:json|cv-actions)?\s*/i, "")
      .replace(/```\s*$/i, "")
      .trim();
    try {
      return unwrap(JSON.parse(trimmed) as unknown);
    } catch {
      return raw;
    }
  }
  if (!raw || typeof raw !== "object") return raw;
  const obj = raw as Record<string, unknown>;
  if ("arguments" in obj) {
    const args = obj.arguments;
    if (typeof args === "string" || (args && typeof args === "object")) return unwrap(args);
  }
  if (obj.function_call && typeof obj.function_call === "object") {
    return unwrap(obj.function_call);
  }
  return raw;
}

/** Принять только полный список. Любая битая строка — отказ, дальше сработает regex-запас. */
export function validateStructuredMeals(
  raw: unknown,
): { ok: true; meals: StructuredMeal[] } | { ok: false; error: string } {
  const value = unwrap(raw);
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return { ok: false, error: "Ожидался объект с meals" };
  }
  const meals = (value as { meals?: unknown }).meals;
  if (!Array.isArray(meals)) return { ok: false, error: "Нет массива meals" };
  if (meals.length > 12) return { ok: false, error: "Слишком много блюд" };
  const parsed: StructuredMeal[] = [];
  for (const row of meals) {
    const meal = readMeal(row);
    if (!meal) return { ok: false, error: "Блюдо не прошло схему" };
    parsed.push(meal);
  }
  return { ok: true, meals: parsed };
}

export function structuredMealsToAssistantMeals(
  meals: StructuredMeal[],
): NonNullable<AssistantActions["meals"]> {
  return meals.map((meal) => {
    const note = mealNoteFromTypeKey(meal.mealSlot);
    return {
      name: meal.name,
      kcal: meal.kcal,
      protein: meal.protein,
      fat: meal.fat,
      carbs: meal.carbs,
      ...(meal.grams != null ? { grams: meal.grams } : {}),
      ...(meal.unit ? { unit: meal.unit } : {}),
      ...(meal.mealSlot ? { mealSlot: meal.mealSlot } : {}),
      ...(note ? { note } : {}),
    };
  });
}
