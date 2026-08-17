export type WeightGoal = "LOSE" | "GAIN" | "MAINTAIN";
export type GoalPace = "SIMPLE" | "HEALTHY" | "FAST";

type DietCoeff = {
  kcal: number;
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

const MAINTAIN_COEFF: DietCoeff = { kcal: 30, protein: 1.6, fat: 1 };

const GOAL_PACE_COEFF: Record<Exclude<WeightGoal, "MAINTAIN">, Record<GoalPace, DietCoeff>> = {
  LOSE: {
    SIMPLE: { kcal: 27, protein: 1.6, fat: 1 },
    HEALTHY: { kcal: 25, protein: 2, fat: 0.8 },
    FAST: { kcal: 21, protein: 2.2, fat: 0.7 },
  },
  GAIN: {
    SIMPLE: { kcal: 33, protein: 1.6, fat: 1 },
    HEALTHY: { kcal: 37, protein: 1.8, fat: 1 },
    FAST: { kcal: 42, protein: 2, fat: 1.2 },
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

function dietCoeff(goal: WeightGoal, pace: GoalPace | null | undefined): DietCoeff {
  if (goal === "MAINTAIN") {
    return MAINTAIN_COEFF;
  }
  return GOAL_PACE_COEFF[goal][pace ?? "HEALTHY"];
}

export function recommendDiet(
  weightKg: number,
  goal: WeightGoal,
  pace: GoalPace | null | undefined = null,
): DietTarget {
  const coeff = dietCoeff(goal, pace);
  const calories = Math.round(weightKg * coeff.kcal);
  const protein = round1(weightKg * coeff.protein);
  const fat = round1(weightKg * coeff.fat);
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
