/**
 * Сводка расхода для списка сессий без полного состава.
 * Считает (MET − 1) × вес × время: сверх покоя, не полный gross.
 * Не подставляет константу «сессия = N ккал».
 */

import {
  estimateSessionEnergy,
  GENERIC_CARDIO_MET,
  type EnergyExercise,
  type SessionEnergy,
} from "@/lib/workouts/energy";

export type WorkoutBurnSessionLike = {
  endedAt?: string | null;
  elapsedSec?: number | null;
  cardioDurationSec?: number | null;
  cardioOnly?: boolean;
  totalLoad?: number | null;
  setCount?: number | null;
  weightKg?: number | null;
  exercises?: readonly EnergyExercise[] | null;
};

function summaryExercises(session: WorkoutBurnSessionLike): EnergyExercise[] {
  if (session.exercises && session.exercises.length > 0) return [...session.exercises];
  const cardioSec = Math.max(0, Number(session.cardioDurationSec) || 0);
  const elapsed = Math.max(0, Number(session.elapsedSec) || 0);
  const out: EnergyExercise[] = [];
  if (cardioSec > 0) {
    out.push({
      name: "Кардио",
      kind: "cardio",
      sets: [{ completed: true, durationSec: cardioSec }],
    });
  }
  const strengthSec = session.cardioOnly ? 0 : Math.max(0, elapsed - cardioSec);
  if (strengthSec > 0) {
    out.push({
      name: "Силовая",
      kind: "strength",
      sets: [{ completed: true }],
    });
  }
  if (out.length === 0 && elapsed > 0 && !session.cardioOnly) {
    out.push({ name: "Силовая", kind: "strength", sets: [{ completed: true }] });
  }
  if (out.length === 0 && (session.setCount ?? 0) > 0) {
    out.push({
      name: "Силовая",
      kind: "strength",
      sets: Array.from({ length: session.setCount ?? 0 }, () => ({ completed: true })),
    });
  }
  return out;
}

export function sessionBurnEnergy(session: WorkoutBurnSessionLike): SessionEnergy {
  const exercises = summaryExercises(session);
  const elapsedSec = Math.max(0, Number(session.elapsedSec) || 0);
  return estimateSessionEnergy({
    weightKg: session.weightKg,
    elapsedSec: exercises.length > 0 ? elapsedSec : 0,
    exercises,
  });
}

/** ~ккал сессии. Кардио без узнанного вида — GENERIC_CARDIO_MET, не фикс «8 ккал/мин». */
export function estimateSessionBurnKcal(session: WorkoutBurnSessionLike): number {
  return sessionBurnEnergy(session).kcal;
}

export function estimateDayWorkoutBurnKcal(sessions: WorkoutBurnSessionLike[]): number {
  let total = 0;
  for (const session of sessions) total += estimateSessionBurnKcal(session);
  return Math.round(total);
}

export function formatWorkoutBurnHint(kcal: number, sessionCount: number): string | null {
  if (kcal <= 0 && sessionCount <= 0) return null;
  if (sessionCount <= 0) return null;
  if (kcal <= 0) {
    return sessionCount === 1 ? "1 тренировка" : `${sessionCount} тренировки`;
  }
  const sessions =
    sessionCount === 1 ? "зал" : sessionCount < 5 ? `${sessionCount} трен.` : `${sessionCount} трен.`;
  return `${sessions} ~${kcal} ккал`;
}

export { GENERIC_CARDIO_MET };
