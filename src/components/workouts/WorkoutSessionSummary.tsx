"use client";

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

  return (
    <div className="fixed inset-0 z-50 flex flex-col overflow-auto bg-gradient-to-b from-teal-950 to-slate-950 text-white">
      <div className="mx-auto flex w-full max-w-lg flex-1 flex-col px-4 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-[max(1.5rem,env(safe-area-inset-top))]">
        <p className="text-xs font-semibold uppercase tracking-widest text-teal-300/90">
          Итог тренировки
        </p>
        <h2 className="mt-2 text-3xl font-semibold leading-tight">{card.headline}</h2>
        <p className="mt-1 text-slate-300">{card.elapsedLabel} · {date}</p>

        <div className="mt-8 grid grid-cols-2 gap-3">
          <div className="rounded-2xl bg-white/10 px-4 py-3">
            <p className="text-xs text-slate-400">Нагрузка</p>
            <p className="mt-1 text-xl font-semibold tabular-nums">
              {formatSummaryLoadLine(card)}
            </p>
          </div>
          <div className="rounded-2xl bg-white/10 px-4 py-3">
            <p className="text-xs text-slate-400">Подходы</p>
            <p className="mt-1 text-xl font-semibold tabular-nums">
              {card.completedSets}/{card.totalSets}
            </p>
          </div>
          {card.deltaPctVsPrevious != null ? (
            <div className="rounded-2xl bg-white/10 px-4 py-3">
              <p className="text-xs text-slate-400">К прошлой</p>
              <p className="mt-1 text-xl font-semibold tabular-nums">
                {card.deltaPctVsPrevious > 0 ? "+" : ""}
                {card.deltaPctVsPrevious}%
              </p>
            </div>
          ) : null}
          {card.prCount > 0 ? (
            <div className="rounded-2xl bg-teal-500/20 px-4 py-3">
              <p className="text-xs text-teal-200">Рекорды</p>
              <p className="mt-1 text-xl font-semibold">{card.prCount}</p>
            </div>
          ) : null}
        </div>

        <ul className="mt-6 space-y-2">
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

        <div className="mt-auto flex flex-col gap-2 pt-8">
          <button
            type="button"
            className="rounded-2xl bg-teal-500 py-3.5 text-base font-bold text-slate-950"
            onClick={onBackToList}
          >
            К списку
          </button>
          <button
            type="button"
            className="rounded-2xl border border-white/20 py-3 text-sm font-semibold"
            onClick={onClose}
          >
            Остаться в тренировке
          </button>
        </div>
      </div>
    </div>
  );
}
