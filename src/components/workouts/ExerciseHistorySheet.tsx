"use client";

import { SceneSkeleton } from "@/components/SceneSkeleton";
import { SessionSheet } from "@/components/workouts/SessionSheet";
import { formatDateShort } from "@/lib/dates";
import {
  formatDistanceKm,
  formatDurationMinutes,
  formatPace,
  formatPaceClock,
} from "@/lib/workouts/cardio";
import { formatWorkoutLoad } from "@/lib/workouts/format";
import type { ExerciseKind } from "@/lib/workouts/exercise-kind";

export type HistoryChartPoint = {
  date: string;
  weight: number;
  volume: number;
  pace: number | null;
  distance: number;
  duration: number;
  reps: number;
};

export type HistoryPoint = {
  date: string;
  kind?: string;
  topWeightKg: number;
  topReps: number;
  totalLoad: number;
  setCount: number;
  distanceKm?: number;
  durationSec?: number;
  bestPaceSecPerKm?: number | null;
};

export type ExerciseHistoryBundle = {
  points: HistoryPoint[];
  chart: HistoryChartPoint[];
  prSummary: string | null;
  kind: string;
  topWeightDeltaKg: number | null;
  bestPaceDeltaSec: number | null;
  metric: "weight" | "volume" | "pace" | "reps" | "duration" | "distance";
};

function sparklinePath(values: number[], width: number, height: number): string {
  if (values.length === 0) return "";
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  return values
    .map((v, i) => {
      const x = values.length === 1 ? width / 2 : (i / (values.length - 1)) * width;
      const y = height - ((v - min) / span) * (height - 4) - 2;
      return `${i === 0 ? "M" : "L"}${x.toFixed(1)} ${y.toFixed(1)}`;
    })
    .join(" ");
}

function ExerciseSparkline({
  points,
  metric,
}: {
  points: HistoryChartPoint[];
  metric: ExerciseHistoryBundle["metric"];
}) {
  const values = points
    .map((p) => {
      if (metric === "weight") return p.weight;
      if (metric === "volume") return p.volume;
      if (metric === "pace") return p.pace ?? 0;
      if (metric === "reps") return p.reps;
      if (metric === "distance") return p.distance;
      return p.duration;
    })
    .filter((v) => Number.isFinite(v) && (metric === "pace" ? v > 0 : true));
  if (values.length < 2) {
    return <p className="mt-2 text-xs text-[var(--muted)]">Мало точек для графика</p>;
  }
  const w = 240;
  const h = 56;
  const d = sparklinePath(values, w, h);
  const last = values[values.length - 1]!;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const lx = w;
  const ly = h - ((last - min) / span) * (h - 4) - 2;
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="gym-spark mt-3 h-28 w-full" aria-hidden>
      <path d={d} fill="none" stroke="var(--accent, #0f766e)" strokeWidth="2" />
      <circle cx={lx} cy={ly} r="3.5" fill="#f59e0b" stroke="#0f172a" strokeWidth="1" />
    </svg>
  );
}

const METRIC_LABEL: Record<ExerciseHistoryBundle["metric"], string> = {
  weight: "Вес",
  volume: "Объём",
  pace: "Темп",
  distance: "Км",
  reps: "Повт",
  duration: "Время",
};

export function ExerciseHistorySheet({
  name,
  kind,
  bundle,
  onMetric,
  onClose,
}: {
  name: string;
  kind: ExerciseKind;
  bundle: ExerciseHistoryBundle | undefined;
  onMetric: (metric: ExerciseHistoryBundle["metric"]) => void;
  onClose: () => void;
}) {
  const isCardio = kind === "cardio";
  const metrics: ExerciseHistoryBundle["metric"][] = isCardio
    ? ["pace", "distance"]
    : kind === "bodyweight"
      ? ["reps"]
      : kind === "duration"
        ? ["duration"]
        : ["weight", "volume"];

  return (
    <SessionSheet title={name} onClose={onClose}>
      {!bundle ? (
        <SceneSkeleton inline label="Загрузка прогресса…" />
      ) : bundle.points.length === 0 ? (
        <p className="text-sm text-[var(--muted)]">Пока нет прошлых записей.</p>
      ) : (
        <div className="text-sm text-[var(--muted-strong)]">
          {bundle.prSummary ? (
            <p className="mb-2 font-semibold text-[var(--accent-ink)]">{bundle.prSummary}</p>
          ) : null}
          <div className="mb-1 flex flex-wrap gap-1">
            {metrics.map((m) => (
              <button
                key={m}
                type="button"
                className={`min-h-[44px] rounded-full px-3 text-xs font-semibold uppercase ${
                  bundle.metric === m
                    ? "bg-[var(--accent)] text-white"
                    : "bg-[var(--accent-soft)] text-[var(--muted-strong)]"
                }`}
                onClick={() => onMetric(m)}
              >
                {METRIC_LABEL[m]}
              </button>
            ))}
          </div>
          <ExerciseSparkline points={bundle.chart} metric={bundle.metric} />
          <ul className="mt-2 space-y-1">
            {bundle.points.map((p) => (
              <li
                key={`${p.date}-${p.topWeightKg}-${p.distanceKm ?? 0}-${p.topReps}`}
                className="flex justify-between gap-2 tabular-nums"
              >
                <span>{formatDateShort(p.date)}</span>
                <span>
                  {p.kind === "cardio" || isCardio
                    ? [
                        p.distanceKm && p.distanceKm > 0
                          ? `${formatDistanceKm(p.distanceKm)} км`
                          : null,
                        p.durationSec && p.durationSec > 0
                          ? formatDurationMinutes(p.durationSec)
                          : null,
                        formatPace(p.bestPaceSecPerKm),
                      ]
                        .filter(Boolean)
                        .join(" · ")
                    : p.kind === "bodyweight"
                      ? `${p.topReps} повт`
                      : p.kind === "duration"
                        ? formatDurationMinutes(p.durationSec ?? 0)
                        : `${p.topWeightKg}×${p.topReps}${
                            p.totalLoad > 0 ? ` · ${formatWorkoutLoad(p.totalLoad)}` : ""
                          }`}
                </span>
              </li>
            ))}
          </ul>
          {isCardio && bundle.bestPaceDeltaSec != null ? (
            <p className="mt-2 text-[var(--accent-ink)]">
              Темп к прошлой: {bundle.bestPaceDeltaSec > 0 ? "+" : ""}
              {formatPaceClock(Math.abs(bundle.bestPaceDeltaSec))}/км
              {bundle.bestPaceDeltaSec < 0 ? " (быстрее)" : ""}
            </p>
          ) : null}
          {!isCardio && bundle.topWeightDeltaKg != null ? (
            <p className="mt-2 text-[var(--accent-ink)]">
              Топ-вес к прошлой: {bundle.topWeightDeltaKg > 0 ? "+" : ""}
              {bundle.topWeightDeltaKg} кг
            </p>
          ) : null}
        </div>
      )}
    </SessionSheet>
  );
}
