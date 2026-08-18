export type WeightGoal = "LOSE" | "GAIN" | "MAINTAIN";
export type GoalPace = "SIMPLE" | "HEALTHY" | "FAST";
export type Sex = "FEMALE" | "MALE";

type DietCoeff = {
  calorieRatio: number;
  protein: number;
  fat: number;
};

export const GOAL_OPTIONS: Array<{ value: WeightGoal; label: string; hint: string }> = [
  { value: "LOSE", label: "Похудеть", hint: "Дефицит калорий" },
  { value: "GAIN", label: "Набрать вес", hint: "Профицит калорий" },
  { value: "MAINTAIN", label: "Удержать вес", hint: "Баланс калорий" },
];

export const PACE_OPTIONS: Array<{ value: GoalPace; label: string }> = [
  { value: "SIMPLE", label: "Как можно проще" },
  { value: "HEALTHY", label: "Здоровым способом" },
  { value: "FAST", label: "Как можно быстрее" },
];

export const SEX_OPTIONS: Array<{ value: Sex; label: string }> = [
  { value: "FEMALE", label: "Женский" },
  { value: "MALE", label: "Мужской" },
];

const PACE_HINTS: Record<Exclude<WeightGoal, "MAINTAIN">, Record<GoalPace, string>> = {
  LOSE: {
    SIMPLE: "Небольшой дефицит, привычная еда",
    HEALTHY: "Умеренный дефицит и больше белка",
    FAST: "Сильный дефицит, быстрее минус вес",
  },
  GAIN: {
    SIMPLE: "Небольшой профицит, привычная еда",
    HEALTHY: "Умеренный профицит и больше белка",
    FAST: "Большой профицит, быстрее плюс вес",
  },
};

/** Mifflin–St Jeor assumes typical adult height/age when those are unknown. */
const DEFAULT_AGE = 35;
const HEIGHT_CM: Record<Sex, number> = { FEMALE: 165, MALE: 175 };
/** Sedentary–light (office + walking), not gym-athlete. */
const ACTIVITY_FACTOR = 1.25;
const MIN_CALORIES: Record<Sex, number> = { FEMALE: 1200, MALE: 1500 };

const MAINTAIN_COEFF: DietCoeff = { calorieRatio: 1, protein: 1.4, fat: 0.8 };

const GOAL_PACE_COEFF: Record<Exclude<WeightGoal, "MAINTAIN">, Record<GoalPace, DietCoeff>> = {
  LOSE: {
    SIMPLE: { calorieRatio: 0.9, protein: 1.5, fat: 0.8 },
    HEALTHY: { calorieRatio: 0.8, protein: 1.7, fat: 0.75 },
    FAST: { calorieRatio: 0.72, protein: 1.9, fat: 0.7 },
  },
  GAIN: {
    SIMPLE: { calorieRatio: 1.08, protein: 1.5, fat: 0.9 },
    HEALTHY: { calorieRatio: 1.15, protein: 1.7, fat: 0.9 },
    FAST: { calorieRatio: 1.2, protein: 1.8, fat: 1 },
  },
};

export function goalNeedsPace(goal: WeightGoal): goal is Exclude<WeightGoal, "MAINTAIN"> {
  return goal === "LOSE" || goal === "GAIN";
}

export function goalLabel(goal: WeightGoal): string {
  return GOAL_OPTIONS.find((option) => option.value === goal)?.label ?? goal;
}

export function goalHint(goal: WeightGoal): string {
  return GOAL_OPTIONS.find((option) => option.value === goal)?.hint ?? "";
}

export function paceLabel(pace: GoalPace): string {
  return PACE_OPTIONS.find((option) => option.value === pace)?.label ?? pace;
}

export function paceHint(goal: WeightGoal, pace: GoalPace): string {
  if (goalNeedsPace(goal)) {
    return PACE_HINTS[goal][pace];
  }
  return goalHint(goal);
}

export function formatGoalChoice(goal: WeightGoal, pace: GoalPace | null | undefined): string {
  if (!goalNeedsPace(goal) || !pace) {
    return goalLabel(goal);
  }
  return `${goalLabel(goal)} · ${paceLabel(pace).toLowerCase()}`;
}

export function savedGoalHint(goal: WeightGoal, pace: GoalPace | null | undefined): string {
  if (!goalNeedsPace(goal) || !pace) {
    return goalHint(goal);
  }
  return paceHint(goal, pace);
}

export function sexLabel(sex: Sex | null | undefined): string | null {
  if (!sex) {
    return null;
  }
  return SEX_OPTIONS.find((option) => option.value === sex)?.label ?? null;
}

export function sexNoun(sex: Sex | null | undefined): string | null {
  if (sex === "FEMALE") {
    return "женщина";
  }
  if (sex === "MALE") {
    return "мужчина";
  }
  return null;
}

export type DietTarget = {
  calories: number;
  protein: number;
  fat: number;
  carbs: number;
};

export type NutrientComparison = {
  actual: number;
  target: number;
  remaining: number;
  kind: "deficit" | "surplus" | "even";
};

export function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

export function isWeightGoal(value: unknown): value is WeightGoal {
  return value === "LOSE" || value === "GAIN" || value === "MAINTAIN";
}

export function isGoalPace(value: unknown): value is GoalPace {
  return value === "SIMPLE" || value === "HEALTHY" || value === "FAST";
}

export function isSex(value: unknown): value is Sex {
  return value === "FEMALE" || value === "MALE";
}

function dietCoeff(goal: WeightGoal, pace: GoalPace | null | undefined): DietCoeff {
  if (goal === "MAINTAIN") {
    return MAINTAIN_COEFF;
  }
  return GOAL_PACE_COEFF[goal][pace ?? "HEALTHY"];
}

function mifflinBmr(weightKg: number, sex: Sex): number {
  const heightCm = HEIGHT_CM[sex];
  const base = 10 * weightKg + 6.25 * heightCm - 5 * DEFAULT_AGE;
  return sex === "MALE" ? base + 5 : base - 161;
}

function maintainCalories(weightKg: number, sex: Sex): number {
  return Math.round(mifflinBmr(weightKg, sex) * ACTIVITY_FACTOR);
}

/**
 * Protein/fat use g per kg, but extra adipose mass should not scale like muscle.
 * Cap at BMI 30 for the assumed height already used in Mifflin–St Jeor.
 */
const MACRO_BMI_CAP = 30;

function weightForMacros(weightKg: number, sex: Sex): number {
  const heightM = HEIGHT_CM[sex] / 100;
  const capKg = MACRO_BMI_CAP * heightM * heightM;
  return Math.min(weightKg, round1(capKg));
}

/**
 * Daily target from Mifflin–St Jeor (lightly active).
 * Sex defaults to female when unknown so calories are not overestimated.
 */
export function recommendDiet(
  weightKg: number,
  goal: WeightGoal,
  pace: GoalPace | null | undefined = null,
  sex: Sex | null | undefined = "FEMALE",
): DietTarget {
  const resolvedSex = isSex(sex) ? sex : "FEMALE";
  const coeff = dietCoeff(goal, pace);
  const calories = Math.max(
    MIN_CALORIES[resolvedSex],
    Math.round(maintainCalories(weightKg, resolvedSex) * coeff.calorieRatio),
  );
  const macroWeight = weightForMacros(weightKg, resolvedSex);
  const protein = round1(macroWeight * coeff.protein);
  const fat = round1(macroWeight * coeff.fat);
  const carbs = Math.max(0, round1((calories - protein * 4 - fat * 9) / 4));

  return { calories, protein, fat, carbs };
}

export function compareNutrient(actual: number, target: number): NutrientComparison {
  const remaining = round1(target - actual);
  const kind = remaining > 0.05 ? "deficit" : remaining < -0.05 ? "surplus" : "even";

  return {
    actual: round1(actual),
    target,
    remaining,
    kind,
  };
}

export function calorieTone(
  comparison: NutrientComparison,
  goal: WeightGoal,
): "good" | "warn" | "ok" {
  const ratio = comparison.target === 0 ? 0 : Math.abs(comparison.remaining) / comparison.target;
  if (comparison.actual === 0 || ratio <= 0.1 || comparison.kind === "even") {
    return "ok";
  }

  if (goal === "LOSE") {
    return comparison.kind === "deficit" ? "good" : "warn";
  }

  if (goal === "GAIN") {
    return comparison.kind === "surplus" ? "good" : "warn";
  }

  return "warn";
}

export function formatSignedKg(value: number): string {
  const rounded = round1(value);
  if (rounded === 0) {
    return "0 кг";
  }

  const sign = rounded > 0 ? "+" : "−";
  return `${sign}${Math.abs(rounded)} кг`;
}

export function formatBalanceLabel(comparison: NutrientComparison, unit: string): string {
  if (comparison.kind === "even") {
    return `норма · ${comparison.target} ${unit}`;
  }

  const amount = Math.abs(comparison.remaining);
  const word = comparison.kind === "deficit" ? "дефицит" : "профицит";
  return `${word} ${amount} ${unit}`;
}
