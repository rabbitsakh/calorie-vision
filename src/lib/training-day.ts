/**
 * Цели дня тренировки поверх базового рациона.
 * База (цель, темп, пол, активность, ручные клетчатка и сахар) не переписывается.
 * Силовая или заметное кардио поднимают белок.
 * К калориям при похудении добавляется половина расхода сессии, при удержании и наборе — весь.
 * Удаление тренировки — снова пустой список сессий, и надбавка исчезает.
 */

import {
  fatAndCarbsForCalories,
  macroWeightKg,
  round1,
  type ActivityLevel,
  type DietTarget,
  type Sex,
  type WeightGoal,
} from "@/lib/diet";
import type { SessionEnergy } from "@/lib/workouts/energy";

/** +0,2 г/кг к белковой цели в день заметной тренировки. */
export const TRAINING_PROTEIN_G_PER_KG = 0.2;
/**
 * Доля оценки расхода сессии, которую добавляем к калориям при цели «похудеть».
 * Удержание и набор оставляют 100%.
 */
export const LOSE_TRAINING_KCAL_SHARE = 0.5;
/** Кардио короче этого не считается «днём тренировки» и не поднимает белок. */
export const NOTABLE_CARDIO_SEC = 15 * 60;
export const NOTABLE_CARDIO_KM = 2;

export type TrainingDayInfo = {
  trainingDay: boolean;
  calorieBonusKcal: number;
  proteinBonusG: number;
  baseCalories: number;
  baseProtein: number;
  burnKcal: number;
  burnApproximate: boolean;
  /** Сессии, из-за которых день считается тренировочным. */
  sessionCount: number;
  /**
   * Раньше умеренная и высокая активность не прибавляли расход второй раз.
   * Теперь зал всегда добавляется в день сессии, поле остаётся false.
   */
  activityAlreadyCountsTraining: boolean;
  /** Одна строка для героя и дневника. */
  label: string | null;
  /** Развёрнуто в блоке нормы: обычная цель и сегодняшняя надбавка. */
  detail: string | null;
};

export type TrainingExerciseLike = {
  kind?: string | null;
  sets?: Array<{
    completed?: boolean | null;
    setType?: string | null;
    durationSec?: number | null;
    distanceKm?: number | null;
  }> | null;
};

/** Сколько ккал расхода сессии попадает в норму дня. Похудение — половина, остальное — целиком. */
export function trainingCalorieBonus(burnKcal: number, goal?: WeightGoal | null): number {
  const burn = Math.max(0, Math.round(Number(burnKcal) || 0));
  const share = goal === "LOSE" ? LOSE_TRAINING_KCAL_SHARE : 1;
  return Math.round(burn * share);
}

/**
 * «2 466 база + 255 за зал». Числа берутся из нормы дня, доля зала здесь не пересчитывается.
 * Если показанная цель не равна базе и бонусу (ручная цель), строку не показываем.
 */
export function formatTrainingNormSplit(
  training: Pick<TrainingDayInfo, "trainingDay" | "baseCalories" | "calorieBonusKcal"> | null | undefined,
  shownCalories?: number | null,
): string | null {
  if (!training?.trainingDay) return null;
  const base = Math.round(training.baseCalories);
  const bonus = Math.round(training.calorieBonusKcal);
  if (!(base > 0) || !(bonus > 0)) return null;
  if (shownCalories != null && Number.isFinite(shownCalories) && Math.round(shownCalories) !== base + bonus) {
    return null;
  }
  return `${base.toLocaleString("ru-RU")} база + ${bonus.toLocaleString("ru-RU")} за зал`;
}

function formatG(value: number): string {
  const rounded = Math.round(value * 10) / 10;
  return Number.isInteger(rounded) ? String(rounded) : String(rounded).replace(".", ",");
}

function workingSetCount(exercises: readonly TrainingExerciseLike[] | null | undefined): number {
  let count = 0;
  for (const exercise of exercises ?? []) {
    if (exercise.kind === "cardio") continue;
    for (const set of exercise.sets ?? []) {
      if (set.completed === false) continue;
      if ((set.setType ?? "working") === "warmup") continue;
      count += 1;
    }
  }
  return count;
}

/** Силовая с рабочими подходами или кардио от 15 минут / 2 км. */
export function isNotableTrainingSession(input: {
  cardioOnly?: boolean;
  cardioDurationSec?: number;
  cardioDistanceKm?: number;
  elapsedSec?: number;
  totalLoad?: number;
  exerciseCount?: number;
  exercises?: readonly TrainingExerciseLike[] | null;
}): boolean {
  const cardioSec = Math.max(0, Number(input.cardioDurationSec) || 0);
  const elapsed = Math.max(0, Number(input.elapsedSec) || 0);
  const notableCardio =
    cardioSec >= NOTABLE_CARDIO_SEC ||
    (Number(input.cardioDistanceKm) || 0) >= NOTABLE_CARDIO_KM ||
    (Boolean(input.cardioOnly) && elapsed >= NOTABLE_CARDIO_SEC);
  const working = workingSetCount(input.exercises);
  const strength =
    !input.cardioOnly &&
    (working > 0 ||
      (Number(input.totalLoad) || 0) > 0 ||
      (elapsed >= 10 * 60 && (input.exerciseCount ?? 0) > 0));
  return notableCardio || strength;
}

export function trainingProteinBonusG(
  weightKg: number,
  sex?: Sex | null,
  heightCm?: number | null,
): number {
  const macro = macroWeightKg(weightKg, sex, heightCm);
  if (!(macro > 0)) return 0;
  return round1(macro * TRAINING_PROTEIN_G_PER_KG);
}

function buildCopy(info: Omit<TrainingDayInfo, "label" | "detail">): Pick<TrainingDayInfo, "label" | "detail"> {
  if (!info.trainingDay && info.calorieBonusKcal <= 0) {
    return { label: null, detail: null };
  }
  const approx = info.burnApproximate ? " Оценка, не измерение." : "";
  if (!info.trainingDay) {
    const label = `К цели добавлены ${info.calorieBonusKcal} ккал сверх покоя${approx ? " · оценка" : ""}`;
    return {
      label,
      detail: `${label}. Это не полный расход: покой уже в норме дня. Белок без изменений: это не силовая и не долгое кардио.`,
    };
  }
  const protein =
    info.proteinBonusG > 0 ? ` · белок +${formatG(info.proteinBonusG)} г` : "";
  const calories =
    info.calorieBonusKcal > 0
      ? `ещё ${info.calorieBonusKcal} ккал сверх покоя`
      : "расход появится, когда будет длительность";
  const label = `День тренировки · ${calories}${protein}${info.burnApproximate ? " · оценка" : ""}`;
  const recovery =
    info.calorieBonusKcal > 0
      ? `ещё ${info.calorieBonusKcal} ккал сверх покоя — оценка, не измерение`
      : "калории тренировки появятся вместе с длительностью";
  const proteinLine =
    info.proteinBonusG > 0
      ? ` и белок +${formatG(info.proteinBonusG)} г (0,2 г/кг)`
      : "";
  const detail = `Обычная цель ${info.baseCalories} ккал и ${formatG(info.baseProtein)} г белка. Сегодня ${recovery}${proteinLine}.`;
  return { label, detail };
}

/**
 * Надбавка к уже посчитанной норме. Исходный объект не меняется.
 * Без сессий возвращает ту же базу — день отдыха.
 */
export function applyTrainingDayGoals(
  base: DietTarget,
  input: {
    trainingDay: boolean;
    burnKcal: number;
    burnApproximate?: boolean;
    sessionCount?: number;
    weightKg: number;
    sex?: Sex | null;
    heightCm?: number | null;
    activityLevel?: ActivityLevel | null;
    goal?: WeightGoal | null;
  },
): { target: DietTarget; training: TrainingDayInfo | null } {
  const burnKcal = Math.max(0, Math.round(Number(input.burnKcal) || 0));
  const trainingDay = Boolean(input.trainingDay);
  const calorieBonusKcal = trainingCalorieBonus(burnKcal, input.goal);
  if (!trainingDay && calorieBonusKcal <= 0) {
    return { target: base, training: null };
  }
  const proteinBonusG = trainingDay
    ? trainingProteinBonusG(input.weightKg, input.sex, input.heightCm)
    : 0;
  const calories = base.calories + calorieBonusKcal;
  const protein = round1(base.protein + proteinBonusG);
  const macro = macroWeightKg(input.weightKg, input.sex, input.heightCm);
  const { fat, carbs } = fatAndCarbsForCalories(calories, protein, macro);
  const partial = {
    trainingDay,
    calorieBonusKcal,
    proteinBonusG,
    baseCalories: base.calories,
    baseProtein: base.protein,
    burnKcal,
    burnApproximate: Boolean(input.burnApproximate) && burnKcal > 0,
    sessionCount: Math.max(0, input.sessionCount ?? (trainingDay ? 1 : 0)),
    activityAlreadyCountsTraining: false,
  };
  const copy = buildCopy(partial);
  const training: TrainingDayInfo = { ...partial, ...copy };
  return {
    target: {
      ...base,
      calories,
      protein,
      fat,
      carbs,
    },
    training,
  };
}

export function dayTrainingFromSessions(
  base: DietTarget | null,
  sessions: Array<{ notable: boolean; energy: SessionEnergy }>,
  profile: {
    weightKg: number;
    sex?: Sex | null;
    heightCm?: number | null;
    activityLevel?: ActivityLevel | null;
    goal?: WeightGoal | null;
  },
): { target: DietTarget | null; training: TrainingDayInfo | null } {
  if (!base) return { target: null, training: null };
  const notable = sessions.filter((session) => session.notable);
  const burnKcal = sessions.reduce((sum, session) => sum + Math.max(0, session.energy.kcal), 0);
  const burnApproximate = sessions.some(
    (session) => session.energy.kcal > 0 && session.energy.approximate,
  );
  return applyTrainingDayGoals(base, {
    trainingDay: notable.length > 0,
    burnKcal,
    burnApproximate,
    sessionCount: notable.length,
    weightKg: profile.weightKg,
    sex: profile.sex,
    heightCm: profile.heightCm,
    activityLevel: profile.activityLevel,
    goal: profile.goal,
  });
}
