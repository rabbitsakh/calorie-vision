export type WeightGoal = "LOSE" | "GAIN" | "MAINTAIN";

export const GOAL_OPTIONS: Array<{ value: WeightGoal; label: string; hint: string }> = [
  { value: "LOSE", label: "Похудеть", hint: "Дефицит калорий" },
  { value: "GAIN", label: "Набрать вес", hint: "Профицит калорий" },
  { value: "MAINTAIN", label: "Удержать вес", hint: "Баланс калорий" },
];

const KCAL_PER_KG: Record<WeightGoal, number> = {
  LOSE: 25,
  MAINTAIN: 30,
  GAIN: 37,
};

const PROTEIN_PER_KG: Record<WeightGoal, number> = {
  LOSE: 2,
  MAINTAIN: 1.6,
  GAIN: 1.8,
};

const FAT_PER_KG: Record<WeightGoal, number> = {
  LOSE: 0.8,
  MAINTAIN: 1,
  GAIN: 1,
};

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

export function recommendDiet(weightKg: number, goal: WeightGoal): DietTarget {
  const calories = Math.round(weightKg * KCAL_PER_KG[goal]);
  const protein = round1(weightKg * PROTEIN_PER_KG[goal]);
  const fat = round1(weightKg * FAT_PER_KG[goal]);
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
