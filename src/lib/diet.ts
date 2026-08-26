export type WeightGoal = "LOSE" | "GAIN" | "MAINTAIN";
export type GoalPace = "SIMPLE" | "HEALTHY" | "FAST";
export type Sex = "FEMALE" | "MALE";
export type ActivityLevel = "SEDENTARY" | "LIGHT" | "MODERATE" | "ACTIVE";

type DietCoeff = {
  calorieRatio: number;
  protein: number;
  fat: number;
};

export const GOAL_OPTIONS: Array<{ value: WeightGoal; label: string; hint: string }> = [
  { value: "LOSE", label: "Похудеть", hint: "Дефицит калорий" },
  { value: "GAIN", label: "Набрать вес", hint: "Профицит калорий" },
  { value: "MAINTAIN", label: "Удержать вес", hint: "Коридор ±10% без давления" },
];

export const ACTIVITY_OPTIONS: Array<{
  value: ActivityLevel;
  label: string;
  hint: string;
  factor: number;
}> = [
  { value: "SEDENTARY", label: "Сидячий", hint: "Офис, мало ходьбы", factor: 1.2 },
  { value: "LIGHT", label: "Лёгкая активность", hint: "Ходьба в течение дня", factor: 1.25 },
  { value: "MODERATE", label: "Умеренная", hint: "Тренировки 3–4 раза в неделю", factor: 1.55 },
  { value: "ACTIVE", label: "Высокая", hint: "Ежедневный спорт или физтруд", factor: 1.725 },
];

export const DEFAULT_ACTIVITY_LEVEL: ActivityLevel = "LIGHT";

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
  /** Soft daily fiber goal (g). */
  fiber: number;
  /** Soft free-sugar cap (g), informational — not a “eat more” target. */
  sugar: number;
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

export function isActivityLevel(value: unknown): value is ActivityLevel {
  return value === "SEDENTARY" || value === "LIGHT" || value === "MODERATE" || value === "ACTIVE";
}

export function activityLabel(level: ActivityLevel | null | undefined): string | null {
  if (!level) return null;
  return ACTIVITY_OPTIONS.find((option) => option.value === level)?.label ?? null;
}

export function activityFactor(level: ActivityLevel | null | undefined): number {
  const resolved = isActivityLevel(level) ? level : DEFAULT_ACTIVITY_LEVEL;
  return ACTIVITY_OPTIONS.find((option) => option.value === resolved)?.factor ?? 1.25;
}

function dietCoeff(goal: WeightGoal, pace: GoalPace | null | undefined): DietCoeff {
  if (goal === "MAINTAIN") {
    return MAINTAIN_COEFF;
  }
  return GOAL_PACE_COEFF[goal][pace ?? "HEALTHY"];
}

function mifflinBmr(weightKg: number, sex: Sex, heightCm?: number | null, age?: number | null): number {
  const h = heightCm && heightCm > 0 ? heightCm : HEIGHT_CM[sex];
  const a = age && age > 0 ? age : DEFAULT_AGE;
  const base = 10 * weightKg + 6.25 * h - 5 * a;
  return sex === "MALE" ? base + 5 : base - 161;
}

function maintainCalories(
  weightKg: number,
  sex: Sex,
  heightCm?: number | null,
  age?: number | null,
  activity?: ActivityLevel | null,
): number {
  return Math.round(mifflinBmr(weightKg, sex, heightCm, age) * activityFactor(activity));
}

/**
 * Protein/fat use g per kg, but extra adipose mass should not scale like muscle.
 * Cap at BMI 30 for the assumed height already used in Mifflin–St Jeor.
 */
const MACRO_BMI_CAP = 30;

function weightForMacros(weightKg: number, sex: Sex, heightCm?: number | null): number {
  const h = heightCm && heightCm > 0 ? heightCm : HEIGHT_CM[sex];
  const heightM = h / 100;
  const capKg = MACRO_BMI_CAP * heightM * heightM;
  return Math.min(weightKg, round1(capKg));
}

/**
 * Daily target from Mifflin–St Jeor × activity level.
 * Sex defaults to female when unknown so calories are not overestimated.
 * Activity defaults to LIGHT (1.25) — same as the previous hardcoded factor.
 */
export function recommendDiet(
  weightKg: number,
  goal: WeightGoal,
  pace: GoalPace | null | undefined = null,
  sex: Sex | null | undefined = "FEMALE",
  heightCm?: number | null,
  birthYear?: number | null,
  activity?: ActivityLevel | null,
): DietTarget {
  const resolvedSex = isSex(sex) ? sex : "FEMALE";
  const age = birthYear ? new Date().getFullYear() - birthYear : null;
  const coeff = dietCoeff(goal, pace);
  const calories = Math.max(
    MIN_CALORIES[resolvedSex],
    Math.round(
      maintainCalories(weightKg, resolvedSex, heightCm, age, activity) * coeff.calorieRatio,
    ),
  );
  const macroWeight = weightForMacros(weightKg, resolvedSex, heightCm);
  const protein = round1(macroWeight * coeff.protein);
  const fat = round1(macroWeight * coeff.fat);
  const carbs = Math.max(0, round1((calories - protein * 4 - fat * 9) / 4));
  // WHO/EFSA-style soft targets: ~25–30 g fiber; free sugars ≤10% energy (~50 g at 2000 kcal).
  const fiber = 28;
  const sugar = Math.max(25, Math.round((calories * 0.1) / 4));

  return { calories, protein, fat, carbs, fiber, sugar };
}

export type DietBreakdown = {
  bmr: number;
  activityLevel: ActivityLevel;
  activityFactor: number;
  maintainCalories: number;
  target: DietTarget;
  explanation: string;
};

/** Human-readable BMR → TDEE → goal target breakdown (Russian). */
export function explainDiet(
  weightKg: number,
  goal: WeightGoal,
  pace: GoalPace | null | undefined = null,
  sex: Sex | null | undefined = "FEMALE",
  heightCm?: number | null,
  birthYear?: number | null,
  activity?: ActivityLevel | null,
): DietBreakdown {
  const resolvedSex = isSex(sex) ? sex : "FEMALE";
  const resolvedActivity = isActivityLevel(activity) ? activity : DEFAULT_ACTIVITY_LEVEL;
  const age = birthYear ? new Date().getFullYear() - birthYear : null;
  const bmr = Math.round(mifflinBmr(weightKg, resolvedSex, heightCm, age));
  const factor = activityFactor(resolvedActivity);
  const maintain = Math.round(bmr * factor);
  const target = recommendDiet(
    weightKg,
    goal,
    pace,
    resolvedSex,
    heightCm,
    birthYear,
    resolvedActivity,
  );
  const activityName = activityLabel(resolvedActivity) ?? "лёгкая активность";
  const goalPart =
    goal === "MAINTAIN"
      ? `Цель «удержать вес»: держитесь коридора около ${target.calories} ккал (±10%).`
      : `С учётом цели норма на день: ${target.calories} ккал.`;
  const explanation = `Базовый обмен (BMR) ≈ ${bmr} ккал. × ${factor} (${activityName}) ≈ ${maintain} ккал на поддержание. ${goalPart}`;
  return {
    bmr,
    activityLevel: resolvedActivity,
    activityFactor: factor,
    maintainCalories: maintain,
    target,
    explanation,
  };
}

/** Apply optional user overrides for fiber goal / sugar soft cap. */
export function applyFiberSugarOverrides(
  target: DietTarget,
  overrides?: { fiberTargetG?: number | null; sugarTargetG?: number | null } | null,
): DietTarget {
  if (!overrides) return target;
  const fiber =
    overrides.fiberTargetG != null &&
    Number.isFinite(overrides.fiberTargetG) &&
    overrides.fiberTargetG > 0
      ? round1(overrides.fiberTargetG)
      : target.fiber;
  const sugar =
    overrides.sugarTargetG != null &&
    Number.isFinite(overrides.sugarTargetG) &&
    overrides.sugarTargetG > 0
      ? round1(overrides.sugarTargetG)
      : target.sugar;
  if (fiber === target.fiber && sugar === target.sugar) return target;
  return { ...target, fiber, sugar };
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

/**
 * Short label under calorie totals.
 * For LOSE, eating below the (already-deficit) target is not framed as "still need to reach goal".
 */
export function formatCalorieVsTargetLabel(
  actual: number,
  target: number,
  goal: WeightGoal | null | undefined,
): string {
  if (actual <= 0) return "";
  const diff = Math.round(actual - target);
  const band = goal === "MAINTAIN" ? 0.1 : 0.05;
  if (Math.abs(diff) <= Math.max(1, Math.round(target * band))) {
    return goal === "MAINTAIN" ? " (в коридоре)" : " (в цели)";
  }
  if (goal === "LOSE") {
    return diff < 0
      ? ` (ниже цели на ${Math.abs(diff)} ккал)`
      : ` (+${diff} ккал сверх цели)`;
  }
  if (goal === "GAIN") {
    return diff < 0
      ? ` (ещё ${Math.abs(diff)} ккал до цели)`
      : ` (+${diff} ккал сверх цели)`;
  }
  return diff < 0
    ? ` (${Math.abs(diff)} ккал до коридора)`
    : ` (+${diff} ккал сверх коридора)`;
}

/**
 * Goal-aware tip when comparing intake to the recommended daily target.
 * For LOSE the target already includes a deficit — going moderately under it is OK.
 * Only warn on extreme undereating (<75% of target).
 */
export const CALORIE_GOAL_CORRIDOR_RATIO = 0.08;
/** Wider band for MAINTAIN — hold weight without pressure to hit an exact number. */
export const MAINTAIN_CORRIDOR_RATIO = 0.1;
export const CALORIE_LOSE_DANGEROUS_RATIO = 0.75;

export function calorieCorridorRatio(goal?: WeightGoal | null): number {
  return goal === "MAINTAIN" ? MAINTAIN_CORRIDOR_RATIO : CALORIE_GOAL_CORRIDOR_RATIO;
}

/** True when intake is within the goal-aware corridor of the daily calorie target. */
export function isCalorieGoalCorridor(
  actual: number,
  target: number,
  goal?: WeightGoal | null,
): boolean {
  if (!(actual > 0) || !(target > 0)) return false;
  return Math.abs(actual - target) <= target * calorieCorridorRatio(goal);
}

/** LOSE: extreme undereating that must not be celebrated. */
export function isDangerousCalorieUndereat(
  actual: number,
  target: number,
  goal: WeightGoal | null | undefined,
): boolean {
  if (goal !== "LOSE") return false;
  if (!(actual > 0) || !(target > 0)) return false;
  return actual < target * CALORIE_LOSE_DANGEROUS_RATIO;
}

export function dailyGoalCelebrationCopy(
  goal: WeightGoal | null | undefined,
  actual?: number,
  target?: number,
): {
  title: string;
  subtitle: string;
} {
  const stats =
    actual != null && target != null && actual > 0 && target > 0
      ? `${actual} / ${target} ккал — `
      : "";

  if (goal === "LOSE") {
    return {
      title: "Цель по калориям",
      subtitle: `${stats}вы в целевом дефиците — отличная работа!`,
    };
  }
  if (goal === "GAIN") {
    return {
      title: "Цель по калориям",
      subtitle: `${stats}вы рядом с целью на набор — так и держите.`,
    };
  }
  return {
    title: "Вес в балансе",
    subtitle: `${stats}вы в комфортном коридоре нормы — можно не гнаться за точным числом.`,
  };
}

export function buildGoalAwareCalorieTip(params: {
  actual: number;
  target: number;
  goal: WeightGoal | null | undefined;
  tense?: "today" | "yesterday" | "average";
}): string {
  const { actual, target, goal } = params;
  const tense = params.tense ?? "yesterday";
  const when =
    tense === "today" ? "Сегодня" : tense === "average" ? "В среднем" : "Вчера";
  const whenLower =
    tense === "today" ? "сегодня" : tense === "average" ? "за период" : "вчера";

  if (actual <= 0) {
    return "Пока нет записей по калориям.";
  }

  const diff = actual - target;
  const abs = Math.round(Math.abs(diff));
  const near = isCalorieGoalCorridor(actual, target, goal);
  const veryLow = actual < target * CALORIE_LOSE_DANGEROUS_RATIO;

  if (near) {
    if (goal === "LOSE") {
      return `${when} вы попали в целевой дефицит — отличная работа!`;
    }
    if (goal === "GAIN") {
      return `${when} вы рядом с целью на набор — так и держите.`;
    }
    return `${when} вы в коридоре нормы (±10%) — для удержания веса этого достаточно.`;
  }

  if (goal === "LOSE") {
    if (diff > 0) {
      return `${when} на ${abs} ккал выше цели похудения — можно чуть легче.`;
    }
    if (veryLow) {
      return `${when} сильно ниже цели (−${abs} ккал). Для похудения это уже жёстко — лучше не урезать ещё сильнее.`;
    }
    return `${when} ниже цели на ${abs} ккал — для похудения это нормально. Следите за самочувствием и белком.`;
  }

  if (goal === "GAIN") {
    if (diff < 0) {
      return `${when} не хватило ${abs} ккал до цели набора — добавьте приём пищи или перекус.`;
    }
    return `${when} выше цели набора (+${abs} ккал) — можно чуть спокойнее, если набор идёт слишком быстро.`;
  }

  // MAINTAIN / unknown — soft corridor, no pressure
  if (diff < 0) {
    return `${when} чуть ниже коридора (−${abs} ккал) — при желании добавьте перекус, без жёстких правил.`;
  }
  return `${when} чуть выше коридора (+${abs} ккал) — ${whenLower === "сегодня" ? "можно спокойнее" : "сегодня можно спокойнее"}, без чувства вины.`;
}
