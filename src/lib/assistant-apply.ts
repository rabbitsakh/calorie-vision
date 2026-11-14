/**
 * Map assistant cv-actions → meal saves / workout routine drafts.
 */

import { sanitizeAssistantMealName, type AssistantActions } from "@/lib/admin-assistant";
import { knownCalories } from "@/lib/known-calories";
import { splitQuickPortion, type QuickMeal } from "@/lib/quick-log";
import { parseMealTimeHHMM } from "@/lib/assistant-meal-time";
import { dateKeyAndTimeToIso } from "@/lib/dates";
import { looksLikeDrinkName } from "@/lib/portion-unit";
import { lookupRuNutritionTable } from "@/lib/ru-nutrition-lookup";
import { isMuscleGroupKey, type MuscleGroupKey } from "@/lib/workouts/muscle-groups";

const FOCUS_HINTS: Array<{ re: RegExp; key: MuscleGroupKey }> = [
  { re: /груд|жим л[её]жа|chest|пекс/i, key: "chest" },
  { re: /спин|тяга|подтягив|back|широчай/i, key: "back" },
  { re: /ног|присед|выпад|бёдр|икр|legs|squat/i, key: "legs" },
  { re: /плеч|жим стоя|shoulders|дельт/i, key: "shoulders" },
  { re: /бицепс|biceps|сгиб/i, key: "biceps" },
  { re: /трицепс|triceps|разгиб/i, key: "triceps" },
  { re: /пресс|кор|abs|core/i, key: "abs" },
  { re: /кардио|бег|велосипед|эллипс|cardio/i, key: "cardio" },
];

export function muscleGroupsFromFocus(focus: string): MuscleGroupKey[] {
  const found: MuscleGroupKey[] = [];
  const seen = new Set<string>();
  for (const hint of FOCUS_HINTS) {
    if (!hint.re.test(focus)) continue;
    if (seen.has(hint.key)) continue;
    seen.add(hint.key);
    found.push(hint.key);
  }
  return found.length ? found : ["other"];
}

/** Fallback real names when AI omits workoutDays[].notes — never «упражнение N». */
const FOCUS_DEFAULT_EXERCISES: Record<MuscleGroupKey, string[]> = {
  chest: ["Жим лёжа", "Разводка гантелей", "Отжимания"],
  back: ["Тяга верхнего блока", "Тяга гантели", "Подтягивания"],
  legs: ["Приседания", "Жим ногами", "Выпады"],
  shoulders: ["Жим стоя", "Разведение в стороны", "Тяга к подбородку"],
  biceps: ["Сгибания со штангой", "Молотковые сгибания", "Сгибания на скамье"],
  triceps: ["Разгибания на блоке", "Французский жим", "Отжимания на брусьях"],
  abs: ["Скручивания", "Планка", "Подъёмы ног"],
  cardio: ["Бег", "Велотренажёр", "Эллипс"],
  other: ["Жим гантелей", "Тяга блока", "Планка"],
};

export function defaultExercisesForFocus(focus: string): string[] {
  const groups = muscleGroupsFromFocus(focus);
  const names: string[] = [];
  const seen = new Set<string>();
  for (const g of groups) {
    for (const n of FOCUS_DEFAULT_EXERCISES[g] ?? FOCUS_DEFAULT_EXERCISES.other) {
      const key = n.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      names.push(n);
      if (names.length >= 3) return names;
    }
  }
  return names.length ? names : FOCUS_DEFAULT_EXERCISES.other.slice(0, 3);
}

export function exercisesFromWorkoutDay(day: {
  focus: string;
  notes?: string;
}): Array<{ name: string; muscleGroup: MuscleGroupKey }> {
  const groups = muscleGroupsFromFocus(day.focus);
  const primary = groups[0] ?? "other";
  const names: string[] = [];
  if (day.notes) {
    for (const part of day.notes.split(/[,;/·•]|\n/)) {
      const n = part.trim().replace(/^\d+[\).\s-]*/, "").slice(0, 80);
      if (n.length >= 2) names.push(n);
      if (names.length >= 6) break;
    }
  }
  if (names.length === 0) {
    names.push(...defaultExercisesForFocus(day.focus));
  }
  return names.map((name, i) => ({
    name,
    muscleGroup: groups[i % groups.length] ?? primary,
  }));
}

export function buildRoutinePayloadFromActions(
  actions: AssistantActions,
  opts?: { namePrefix?: string },
): {
  name: string;
  note: string;
  muscleGroups: MuscleGroupKey[];
  exercises: Array<{ name: string; muscleGroup: MuscleGroupKey }>;
} | null {
  const days = actions.workoutDays ?? [];
  if (!days.length) return null;
  const allExercises: Array<{ name: string; muscleGroup: MuscleGroupKey }> = [];
  const muscleSet = new Set<MuscleGroupKey>();
  for (const day of days.slice(0, 7)) {
    const exs = exercisesFromWorkoutDay(day);
    for (const ex of exs) {
      allExercises.push({
        name: `${day.day}: ${ex.name}`.slice(0, 120),
        muscleGroup: ex.muscleGroup,
      });
      muscleSet.add(ex.muscleGroup);
    }
  }
  if (!allExercises.length) return null;
  const muscleGroups = [...muscleSet].filter(isMuscleGroupKey);
  const prefix = opts?.namePrefix?.trim() || "План AI";
  const name = `${prefix}: ${days
    .slice(0, 3)
    .map((d) => d.day)
    .join(", ")}`.slice(0, 120);
  const note = (actions.summary || days.map((d) => `${d.day} — ${d.focus}`).join("; ")).slice(
    0,
    200,
  );
  return {
    name,
    note,
    muscleGroups: muscleGroups.length ? muscleGroups : ["other"],
    exercises: allExercises.slice(0, 24),
  };
}

function figuresDiverge(model: number, reference: number): boolean {
  if (!(model > 0) || !(reference > 0)) return false;
  const ratio = model / reference;
  return ratio > 1.5 || ratio < 1 / 1.5;
}

function scaleMeal<T extends QuickMeal>(meal: T, fromGrams: number, toGrams: number): T {
  const scale = toGrams / fromGrams;
  const macro = (value: number | undefined) =>
    value == null || !Number.isFinite(value) ? value : Math.round(value * scale * 10) / 10;
  return {
    ...meal,
    grams: toGrams,
    kcal: meal.kcal != null ? Math.round(meal.kcal * scale) : meal.kcal,
    protein: macro(meal.protein),
    fat: macro(meal.fat),
    carbs: macro(meal.carbs),
  };
}

/**
 * «100 г», которых не было в сообщении, — не порция.
 * Если в справочнике есть типовая, берём её. «мл» остаётся только у напитков.
 */
export function alignAssistantMealUnits(meals: QuickMeal[], userMessage: string): QuickMeal[] {
  const userSaid100 = /(?:^|[^\d])100\s*(?:г|гр|грамм(?:а|ов)?|мл)/iu.test(userMessage);
  return meals.map((meal) => {
    const named = splitQuickPortion(sanitizeAssistantMealName(meal.name));
    const base = (named.base || meal.name).trim();
    const drink = looksLikeDrinkName(base, meal.name);
    let unit: "г" | "мл" | "шт" =
      meal.unit === "шт" ? "шт" : drink && (meal.unit === "мл" || named.unit === "мл") ? "мл" : "г";
    if (!drink && unit === "мл") unit = "г";
    let grams =
      typeof meal.grams === "number" && meal.grams > 0
        ? Math.round(meal.grams)
        : named.grams != null && named.grams > 0
          ? named.grams
          : undefined;
    let next = meal;
    if (grams === 100 && !userSaid100 && unit !== "шт") {
      const pack = lookupRuNutritionTable(base);
      if (pack && pack.portionGrams > 0 && pack.portionGrams !== 100) {
        const tablePer100 = (pack.calories * 100) / pack.portionGrams;
        if (meal.kcal != null && !figuresDiverge(meal.kcal, pack.calories)) {
          grams = Math.round(pack.portionGrams);
        } else if (meal.kcal != null && !figuresDiverge(meal.kcal, tablePer100)) {
          next = scaleMeal(meal, 100, Math.round(pack.portionGrams));
          grams = Math.round(pack.portionGrams);
        } else {
          grams = Math.round(pack.portionGrams);
        }
      } else if (!pack) {
        grams = undefined;
      }
    }
    const name =
      grams != null && unit !== "шт"
        ? `${base} (${grams} ${unit})`.slice(0, 120)
        : base.slice(0, 120);
    return { ...next, name, ...(grams != null ? { grams } : { grams: undefined }), unit };
  });
}

export function mealsPayloadFromActions(
  actions: AssistantActions,
  date: string,
  timezone?: string | null,
): Array<{
  date: string;
  dishName: string;
  calories: number;
  protein?: number;
  fat?: number;
  carbs?: number;
  recognitionSource: string;
  eatenAt?: string;
  portionGrams?: number;
}> {
  const meals = actions.meals ?? [];
  return meals
    .filter((m) => m.name.trim())
    .filter((m) => m.nutritionBasis !== "unknown")
    .filter((m) => !(m.unparsed && !(typeof m.kcal === "number" && m.kcal > 0)))
    .filter((m) => knownCalories(m.kcal) != null)
    .slice(0, 12)
    .map((m) => {
      const time = parseMealTimeHHMM(m.time);
      const eatenAt = time ? dateKeyAndTimeToIso(date, time, timezone) : null;
      const named = splitQuickPortion(sanitizeAssistantMealName(m.name));
      const base = (named.base || m.name).trim();
      const drink = looksLikeDrinkName(base, m.name);
      const grams =
        typeof m.grams === "number" && Number.isFinite(m.grams) && m.grams > 0
          ? Math.round(m.grams)
          : named.grams != null && named.grams > 0
            ? named.grams
            : undefined;
      const unit =
        m.unit === "шт"
          ? "шт"
          : drink && (m.unit === "мл" || named.unit === "мл")
            ? "мл"
            : "г";
      const dishName =
        grams != null && unit !== "шт"
          ? `${base} (${grams} ${unit})`.slice(0, 200)
          : base.slice(0, 200);
      return {
        date,
        dishName,
        calories: knownCalories(m.kcal) ?? 0,
        ...(grams != null && grams > 0 && unit !== "шт" ? { portionGrams: grams } : {}),
        ...(typeof m.protein === "number" && Number.isFinite(m.protein)
          ? { protein: Math.max(0, m.protein) }
          : {}),
        ...(typeof m.fat === "number" && Number.isFinite(m.fat) ? { fat: Math.max(0, m.fat) } : {}),
        ...(typeof m.carbs === "number" && Number.isFinite(m.carbs)
          ? { carbs: Math.max(0, m.carbs) }
          : {}),
        recognitionSource: "assistant",
        ...(eatenAt ? { eatenAt } : {}),
      };
    });
}
