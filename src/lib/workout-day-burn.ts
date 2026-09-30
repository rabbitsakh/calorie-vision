/**
 * Soft display-only estimate of workout energy for the day hero / next-step.
 * Not a medical MET calc — just enough to link Зал ↔ рацион.
 */

export type WorkoutBurnSessionLike = {
  endedAt?: string | null;
  elapsedSec?: number | null;
  cardioDurationSec?: number | null;
  cardioOnly?: boolean;
  totalLoad?: number | null;
  setCount?: number | null;
};

/** ~kcal from finished (or clocked) sessions for a calendar day. */
export function estimateDayWorkoutBurnKcal(sessions: WorkoutBurnSessionLike[]): number {
  let total = 0;
  for (const s of sessions) {
    total += estimateSessionBurnKcal(s);
  }
  return Math.round(total);
}

export function estimateSessionBurnKcal(session: WorkoutBurnSessionLike): number {
  const cardioSec = Math.max(0, Number(session.cardioDurationSec) || 0);
  const elapsedSec = Math.max(0, Number(session.elapsedSec) || 0);
  const load = Math.max(0, Number(session.totalLoad) || 0);
  const sets = Math.max(0, Number(session.setCount) || 0);

  // Prefer cardio clock when present (~8 kcal/min moderate).
  if (cardioSec > 0) {
    const cardio = (cardioSec / 60) * 8;
    if (session.cardioOnly) return Math.max(40, Math.round(cardio));
    // Mixed day: cardio + light strength from remaining clock / load.
    const strengthMin = Math.max(0, (elapsedSec - cardioSec) / 60);
    const strength = strengthMin > 0 ? strengthMin * 5 : Math.min(120, load * 0.05 + sets * 4);
    return Math.max(40, Math.round(cardio + strength));
  }

  if (elapsedSec > 0) {
    // Strength / general session ~5 kcal/min.
    return Math.max(40, Math.round((elapsedSec / 60) * 5));
  }

  // No clock — rough from tonnage / set count.
  if (load > 0 || sets > 0) {
    return Math.max(40, Math.round(Math.min(400, load * 0.05 + sets * 5)));
  }

  // Finished with no metrics — tiny presence signal.
  if (session.endedAt) return 80;
  return 0;
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
