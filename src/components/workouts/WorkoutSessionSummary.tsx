"use client";

import { StageScreen, type StageMetric } from "@/components/StageScreen";
import {
  buildSessionSummary,
  formatSummaryLoadLine,
  type SummaryExercise,
} from "@/lib/workouts/session-summary";

type Props = {
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
  onClose: () => void;
  onBackToList: () => void;
};

export function WorkoutSessionSummary({
  date,
  elapsedSec,
  totalLoad,
  cardioDistanceKm,
  cardioDurationSec,
  cardioOnly,
  deltaPctVsPrevious,
  deltaPctVsTarget,
  previousLoad,
  targetLoad,
  exercises,
  onClose,
  onBackToList,
}: Props) {
  const card = buildSessionSummary({
    date,
    elapsedSec,
    totalLoad,
    cardioDistanceKm,
    cardioDurationSec,
    cardioOnly,
    deltaPctVsPrevious,
    deltaPctVsTarget,
    previousLoad,
    targetLoad,
    exercises,
  });

  const metrics: StageMetric[] = [
    {
      key: "load",
      label: "Нагрузка",
      value: formatSummaryLoadLine(card),
    },
    {
      key: "sets",
      label: "Подходы",
      value: `${card.completedSets}/${card.totalSets}`,
    },
  ];

  if (card.deltaPctVsPrevious != null) {
    metrics.push({
      key: "delta",
      label: "К прошлой",
      value: `${card.deltaPctVsPrevious > 0 ? "+" : ""}${card.deltaPctVsPrevious}%`,
    });
  }

  if (card.prCount > 0) {
    metrics.push({
      key: "prs",
      label: "Рекорды",
      value: card.prCount,
      accent: true,
    });
  }

  return (
    <StageScreen
      eyebrow="Итог тренировки"
      headline={card.headline}
      subline={`${card.elapsedLabel} · ${date}`}
      metrics={metrics}
      primaryAction={{ label: "К списку", onClick: onBackToList }}
      secondaryAction={{ label: "Остаться в тренировке", onClick: onClose }}
    >
      <ul className="space-y-2">
        {card.exercises.map((ex) => (
          <li
            key={ex.name}
            className="flex items-start justify-between gap-3 rounded-xl bg-white/5 px-3 py-2.5"
          >
            <div className="min-w-0">
              <p className="truncate font-medium">{ex.name}</p>
              {ex.prLine ? (
                <p className="text-xs font-semibold text-teal-300">{ex.prLine}</p>
              ) : ex.progressionKind === "stall" ? (
                <p className="text-xs text-amber-200">Плато — подумайте о deload</p>
              ) : null}
            </div>
            <p className="shrink-0 text-sm tabular-nums text-slate-300">
              {ex.completedCount}/{ex.setCount}
              {ex.load > 0 ? ` · ${Math.round(ex.load)}` : ""}
            </p>
          </li>
        ))}
      </ul>
    </StageScreen>
  );
}
