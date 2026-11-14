import { alcoholEnergyKcal, atwaterKcal } from "@/lib/nutrition-consistency";

export type MacroNumbers = {
  protein?: number | null;
  fat?: number | null;
  carbs?: number | null;
  fiber?: number | null;
  sugar?: number | null;
};

const ATWATER_WARN = 0.25;

function scaleOne(value: number | null | undefined, ratio: number): number | null | undefined {
  if (value == null || !Number.isFinite(value)) return value;
  return Math.round(value * ratio * 10) / 10;
}

/** Пропорция ккал → БЖУ. Ноль нутриента остаётся нулём. */
export function scaleMacrosToCalories(
  previousKcal: number,
  nextKcal: number,
  macros: MacroNumbers,
): MacroNumbers {
  if (!(previousKcal > 0) || !(nextKcal > 0) || previousKcal === nextKcal) return macros;
  const ratio = nextKcal / previousKcal;
  return {
    protein: scaleOne(macros.protein, ratio),
    fat: scaleOne(macros.fat, ratio),
    carbs: scaleOne(macros.carbs, ratio),
    fiber: scaleOne(macros.fiber, ratio),
    sugar: scaleOne(macros.sugar, ratio),
  };
}

export function macrosNearlyEqual(
  left: number | null | undefined,
  right: number | null | undefined,
): boolean {
  if (left == null && right == null) return true;
  if (left == null || right == null) return false;
  return Math.abs(left - right) <= 0.2;
}

/** Ккал и БЖУ разошлись больше чем на 25%. Алкоголь учитывает 7 ккал/г этанола, если известна порция. */
export function macrosDivergeFromCalories(input: {
  name?: string;
  kcal: number;
  protein?: number | null;
  fat?: number | null;
  carbs?: number | null;
  portionGrams?: number | null;
}): boolean {
  const protein = input.protein ?? 0;
  const fat = input.fat ?? 0;
  const carbs = input.carbs ?? 0;
  if (protein + fat + carbs < 0.5 || !(input.kcal > 0)) return false;
  const ethanol = alcoholEnergyKcal(input.name, input.portionGrams ?? undefined);
  const expected = atwaterKcal(protein, fat, carbs) + ethanol;
  if (!(expected > 0)) return false;
  return Math.abs(input.kcal - expected) / Math.max(input.kcal, expected) > ATWATER_WARN;
}

export const MACRO_DIVERGENCE_WARNING = "Ккал не сходятся с БЖУ. Проверьте цифры.";

function sameMacro(left: number | null | undefined, right: number | null | undefined): boolean {
  return macrosNearlyEqual(left ?? null, right ?? null);
}

/**
 * Ккал поменялись, а БЖУ нет — масштабируем. Если правили и то и другое и они не сходятся, не затираем.
 */
export function reconcileCalorieEdit(input: {
  name: string;
  previousKcal: number;
  nextKcal: number;
  stored: MacroNumbers;
  /** null — клиент не прислал БЖУ. */
  sent: MacroNumbers | null;
  portionGrams?: number | null;
}): { macros: MacroNumbers; warning: string | null } {
  const scaled = scaleMacrosToCalories(input.previousKcal, input.nextKcal, input.stored);
  const sent = input.sent;
  const untouched =
    sent == null ||
    (sameMacro(sent.protein, input.stored.protein) &&
      sameMacro(sent.fat, input.stored.fat) &&
      sameMacro(sent.carbs, input.stored.carbs));
  const alreadyScaled =
    sent != null &&
    sameMacro(sent.protein, scaled.protein) &&
    sameMacro(sent.fat, scaled.fat) &&
    sameMacro(sent.carbs, scaled.carbs);
  if (untouched || alreadyScaled || input.previousKcal === input.nextKcal) {
    return { macros: input.previousKcal === input.nextKcal ? (sent ?? input.stored) : scaled, warning: null };
  }
  const next = sent ?? input.stored;
  const warning = macrosDivergeFromCalories({
    name: input.name,
    kcal: input.nextKcal,
    protein: next.protein,
    fat: next.fat,
    carbs: next.carbs,
    portionGrams: input.portionGrams,
  })
    ? MACRO_DIVERGENCE_WARNING
    : null;
  return { macros: next, warning };
}
