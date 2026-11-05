/**
 * Цели дня тренировки поверх базового рациона.
 * База (цель, темп, пол, активность, ручные клетчатка и сахар) не переписывается.
 * Силовая или заметное кардио поднимают калории на расход тренировки и белок.
 * Удаление тренировки — снова пустой список сессий, и надбавка исчезает.
 */

import { macroWeightKg, round1, type DietTarget, type Sex } from "@/lib/diet";
import type { SessionEnergy } from "@/lib/workouts/energy";

/** +0,25 г/кг — внутри обычной вилки 0,2–0,3 г/кг к уже посчитанной белковой цели. */
export const TRAINING_PROTEIN_G_PER_KG = 0.25;
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
  const approx = info.burnApproximate ? " · калории приблизительные" : "";
  if (!info.trainingDay) {
    const label = `К цели добавлены ${info.calorieBonusKcal} ккал за тренировку${approx}`;
    return {
      label,
      detail: `${label}. Белок без изменений: это не силовая и не долгое кардио.`,
    };
  }
  const protein =
    info.proteinBonusG > 0 ? ` · белок +${formatG(info.proteinBonusG)} г` : "";
  const calories =
    info.calorieBonusKcal > 0
      ? `ещё ${info.calorieBonusKcal} ккал на восстановление`
      : "расход появится, когда будет длительность";
  const label = `День тренировки · ${calories}${protein}${approx}`;
  const recovery =
    info.calorieBonusKcal > 0
      ? `ещё ${info.calorieBonusKcal} ккал на восстановление`
      : "калории тренировки появятся вместе с длительностью";
  const proteinLine =
    info.proteinBonusG > 0
      ? ` и белок +${formatG(info.proteinBonusG)} г (0,25 г/кг)`
      : "";
  const detail = `Обычная цель ${info.baseCalories} ккал и ${formatG(info.baseProtein)} г белка. Сегодня ${recovery}${proteinLine}.${info.burnApproximate ? " Калории тренировки приблизительные." : ""}`;
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
  },
): { target: DietTarget; training: TrainingDayInfo | null } {
  const burnKcal = Math.max(0, Math.round(Number(input.burnKcal) || 0));
  const trainingDay = Boolean(input.trainingDay);
  if (!trainingDay && burnKcal <= 0) {
    return { target: base, training: null };
  }
  const proteinBonusG = trainingDay
    ? trainingProteinBonusG(input.weightKg, input.sex, input.heightCm)
    : 0;
  const calorieBonusKcal = burnKcal;
  const partial = {
    trainingDay,
    calorieBonusKcal,
    proteinBonusG,
    baseCalories: base.calories,
    baseProtein: base.protein,
    burnKcal,
    burnApproximate: Boolean(input.burnApproximate) && burnKcal > 0,
    sessionCount: Math.max(0, input.sessionCount ?? (trainingDay ? 1 : 0)),
  };
  const copy = buildCopy(partial);
  const training: TrainingDayInfo = { ...partial, ...copy };
  return {
    target: {
      ...base,
      calories: base.calories + calorieBonusKcal,
      protein: round1(base.protein + proteinBonusG),
    },
    training,
  };
}

export function dayTrainingFromSessions(
  base: DietTarget | null,
  sessions: Array<{ notable: boolean; energy: SessionEnergy }>,
  profile: { weightKg: number; sex?: Sex | null; heightCm?: number | null },
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
  });
}
