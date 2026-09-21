import { formatSessionClock } from "@/lib/workouts/session-clock";
import { formatDistanceKm, formatDurationMinutes } from "@/lib/workouts/cardio";

export type SummaryExercise = {
  name: string;
  load: number;
  setCount: number;
  completedCount: number;
  prLine?: string | null;
  progressionKind?: string | null;
};

export type SessionSummaryCard = {
  date: string;
  elapsedLabel: string;
  elapsedSec: number;
  totalLoad: number;
  cardioDistanceKm: number;
  cardioDurationSec: number;
  cardioOnly: boolean;
  exerciseCount: number;
  completedSets: number;
  totalSets: number;
  deltaPctVsPrevious: number | null;
  deltaPctVsTarget: number | null;
  previousLoad: number;
  targetLoad: number;
  exercises: SummaryExercise[];
  prCount: number;
  headline: string;
};

export function buildSessionSummary(input: {
  date: string;
  elapsedSec: number;
  totalLoad: number;
  cardioDistanceKm: number;
  cardioDurationSec: number;
  cardioOnly: boolean;
  deltaPctVsPrevious: number | null;
  deltaPctVsTarget: number | null;
  previousLoad: number;
  targetLoad: number;
  exercises: SummaryExercise[];
}): SessionSummaryCard {
  const completedSets = input.exercises.reduce((n, e) => n + e.completedCount, 0);
  const totalSets = input.exercises.reduce((n, e) => n + e.setCount, 0);
  const prCount = input.exercises.filter((e) => e.prLine).length;

  let headline = "Тренировка закрыта";
  if (prCount > 0) headline = `Готово · ${prCount} PR`;
  else if (input.deltaPctVsPrevious != null && input.deltaPctVsPrevious >= 0) {
    headline = `Готово · +${input.deltaPctVsPrevious}% к прошлой`;
  } else if (input.cardioOnly && input.cardioDistanceKm > 0) {
    headline = `Готово · ${formatDistanceKm(input.cardioDistanceKm)} км`;
  }

  return {
    date: input.date,
    elapsedLabel: formatSessionClock(input.elapsedSec),
    elapsedSec: input.elapsedSec,
    totalLoad: input.totalLoad,
    cardioDistanceKm: input.cardioDistanceKm,
    cardioDurationSec: input.cardioDurationSec,
    cardioOnly: input.cardioOnly,
    exerciseCount: input.exercises.length,
    completedSets,
    totalSets,
    deltaPctVsPrevious: input.deltaPctVsPrevious,
    deltaPctVsTarget: input.deltaPctVsTarget,
    previousLoad: input.previousLoad,
    targetLoad: input.targetLoad,
    exercises: input.exercises,
    prCount,
    headline,
  };
}

export function formatSummaryLoadLine(card: SessionSummaryCard): string {
  if (card.cardioOnly) {
    const parts = [
      card.cardioDistanceKm > 0 ? `${formatDistanceKm(card.cardioDistanceKm)} км` : null,
      card.cardioDurationSec > 0 ? formatDurationMinutes(card.cardioDurationSec) : null,
    ].filter(Boolean);
    return parts.join(" · ") || "—";
  }
  return `${Math.round(card.totalLoad)} кг·повт`;
}
