/**
 * Одна норма на конкретный день: калории, БЖУ, клетчатка, сахар и вода.
 * Карточка «Сегодня», лента, идеи, график, бейджи, пуши и онбординг берут её.
 * Ручные калории, БЖУ, клетчатка, сахар и вода не пересчитываются.
 */

import {
  applyFiberSugarOverrides,
  explainDiet,
  fatAndCarbsForCalories,
  fiberForCalories,
  isActivityLevel,
  isGoalPace,
  isSex,
  isWeightGoal,
  macroWeightKg,
  sugarForCalories,
  type ActivityLevel,
  type DietProfileFields,
  type DietTarget,
  type GoalPace,
  type Sex,
  type WeightGoal,
} from "@/lib/diet";
import { applyTrainingDayGoals, type TrainingDayInfo } from "@/lib/training-day";
import { isValidWaterTargetMl, recommendWaterMl } from "@/lib/water-target";

export type ManualDayNorm = {
  calories?: number | null;
  protein?: number | null;
  fat?: number | null;
  carbs?: number | null;
  fiber?: number | null;
  sugar?: number | null;
  waterMl?: number | null;
};

export type DayNorm = DietTarget & {
  waterMl: number;
};

export type DayNormResult = {
  target: DayNorm;
  training: TrainingDayInfo | null;
  bmr: number;
  maintainCalories: number;
  activityFactor: number;
  explanation: string;
  /** Калории или БЖУ взяты из ручной цели. */
  manual: boolean;
};

function positive(value: number | null | undefined): number | null {
  if (value == null || !Number.isFinite(value) || value <= 0) return null;
  return value;
}

function lockedWater(value: number | null | undefined): number | null {
  if (!isValidWaterTargetMl(value)) return null;
  return Math.round(value);
}

export function resolveDayNorm(input: {
  weightKg: number;
  goal: WeightGoal;
  pace?: GoalPace | null;
  sex?: Sex | null;
  heightCm?: number | null;
  birthYear?: number | null;
  activity?: ActivityLevel | null;
  /** Расход тренировок сверх покоя. В день сессии и к короткому кардио. При похудении — половина. */
  burnKcal?: number;
  trainingDay?: boolean;
  burnApproximate?: boolean;
  sessionCount?: number;
  fiberTargetG?: number | null;
  sugarTargetG?: number | null;
  waterTargetMl?: number | null;
  manual?: ManualDayNorm | null;
}): DayNormResult {
  const sex = isSex(input.sex) ? input.sex : "FEMALE";
  const activity = isActivityLevel(input.activity) ? input.activity : null;
  const explained = explainDiet(
    input.weightKg,
    input.goal,
    input.pace,
    sex,
    input.heightCm,
    input.birthYear,
    activity,
  );
  const base = applyFiberSugarOverrides(explained.target, {
    fiberTargetG: input.fiberTargetG,
    sugarTargetG: input.sugarTargetG,
  });
  const adjusted = applyTrainingDayGoals(base, {
    trainingDay: Boolean(input.trainingDay),
    burnKcal: input.burnKcal ?? 0,
    burnApproximate: input.burnApproximate,
    sessionCount: input.sessionCount,
    weightKg: input.weightKg,
    sex,
    heightCm: input.heightCm,
    activityLevel: activity,
    goal: input.goal,
  });
  const auto = adjusted.target;
  const manualCalories = positive(input.manual?.calories);
  const manualProtein = positive(input.manual?.protein);
  const manualFat = positive(input.manual?.fat);
  const manualCarbs = positive(input.manual?.carbs);
  const manual = manualCalories != null || manualProtein != null || manualFat != null || manualCarbs != null;

  const calories = manualCalories ?? auto.calories;
  const protein = manualProtein ?? auto.protein;
  let fat = manualFat ?? auto.fat;
  let carbs = manualCarbs ?? auto.carbs;
  if (manual && manualCarbs == null) {
    const balanced = fatAndCarbsForCalories(
      calories,
      protein,
      macroWeightKg(input.weightKg, sex, input.heightCm),
    );
    if (manualFat == null) fat = balanced.fat;
    carbs = balanced.carbs;
  }

  const fiber = positive(input.manual?.fiber) ?? positive(input.fiberTargetG) ?? fiberForCalories(calories);
  const sugar = positive(input.manual?.sugar) ?? positive(input.sugarTargetG) ?? sugarForCalories(calories);
  const trainingDay = Boolean(adjusted.training?.trainingDay);
  const waterMl =
    lockedWater(input.waterTargetMl) ??
    lockedWater(input.manual?.waterMl) ??
    recommendWaterMl(input.weightKg, sex, trainingDay, input.heightCm);

  return {
    target: {
      calories: Math.round(calories),
      protein: roundProtein(protein),
      fat: roundProtein(fat),
      carbs: roundProtein(carbs),
      fiber,
      sugar,
      waterMl,
    },
    training: adjusted.training,
    bmr: explained.bmr,
    maintainCalories: explained.maintainCalories,
    activityFactor: explained.activityFactor,
    explanation: explained.explanation,
    manual,
  };
}

function roundProtein(value: number): number {
  return Math.round(value * 10) / 10;
}

/** План без сессии зала: онбординг и профиль показывают это же число. */
export function resolvePlanNorm(
  weightKg: number | null | undefined,
  profile: (DietProfileFields & {
    fiberTargetG?: number | null;
    sugarTargetG?: number | null;
    waterTargetMl?: number | null;
  }) | null | undefined,
  manual?: ManualDayNorm | null,
): DayNormResult | null {
  if (weightKg == null || !Number.isFinite(weightKg) || weightKg <= 0) return null;
  if (!profile || !isWeightGoal(profile.goal)) return null;
  return resolveDayNorm({
    weightKg,
    goal: profile.goal,
    pace: isGoalPace(profile.goalPace) ? profile.goalPace : null,
    sex: isSex(profile.sex) ? profile.sex : null,
    heightCm: profile.heightCm,
    birthYear: profile.birthYear,
    activity: isActivityLevel(profile.activityLevel) ? profile.activityLevel : null,
    fiberTargetG: profile.fiberTargetG,
    sugarTargetG: profile.sugarTargetG,
    waterTargetMl: profile.waterTargetMl,
    manual,
  });
}
