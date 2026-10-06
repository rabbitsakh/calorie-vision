"use client";

import {
  formatDateShort,
  formatDateWords,
  formatMonthTitle,
  getMonthGrid,
} from "@/lib/dates";
import {
  formatDistanceKm,
  formatDurationMinutes,
} from "@/lib/workouts/cardio";
import { formatWorkoutLoad, formatWorkoutTrend } from "@/lib/workouts/format";
import { MUSCLE_GROUPS, type MuscleGroupKey } from "@/lib/workouts/muscle-groups";

export type HistorySessionRow = {
  id: string;
  date: string;
  muscleLabels: string[];
  exerciseCount: number;
  setCount: number;
  totalLoad: number;
  cardioOnly: boolean;
  cardioDistanceKm: number;
  cardioDurationSec: number;
  note?: string | null;
};

export type HistoryInsights = {
  weekStart: string;
  weekEnd: string;
  weeklyTotal: number;
  weeklyByGroup: Record<string, { load: number; label: string }>;
  weeklyCardioKm?: number;
  weekTrendPct?: number | null;
  weekCardioTrendPct?: number | null;
  sessionCount: number;
  monthStart?: string;
  monthlyTotal?: number;
  monthlyCardioKm?: number;
  monthlySessionCount?: number;
  monthTrendPct?: number | null;
};

type Props = {
  todayKey: string;
  sessions: HistorySessionRow[];
  loading: boolean;
  error: string | null;
  creating: boolean;
  busy: boolean;
  queuedSets: number;
  insights: HistoryInsights | null;
  filterPeriod: "all" | "week" | "month" | "day";
  filterDate: string | null;
  filterCardio: boolean;
  filterGroups: MuscleGroupKey[];
  calYear: number;
  calMonth: number;
  calMarked: Record<string, number>;
  monthSummary: {
    sessionCount: number;
    tonnage: number;
    cardioDistanceKm: number;
  } | null;
  onNewSession: (date: string) => void;
  onCalPrev: () => void;
  onCalNext: () => void;
  onPickDay: (day: string) => void;
  onSetFilterPeriod: (period: "all" | "week" | "month" | "day") => void;
  onToggleCardio: () => void;
  onToggleGroup: (key: MuscleGroupKey) => void;
  onFlushQueue: () => void;
  onOpenSession: (id: string) => void;
  onRepeat: (id: string) => void;
  onSaveAsRoutine: (id: string, name: string) => void;
};

/** Hub «История» — calendar, filters, insights, session list. */
export function WorkoutHistoryHub({
  todayKey,
  sessions,
  loading,
  error,
  creating,
  busy,
  queuedSets,
  insights,
  filterPeriod,
  filterDate,
  filterCardio,
  filterGroups,
  calYear,
  calMonth,
  calMarked,
  monthSummary,
  onNewSession,
  onCalPrev,
  onCalNext,
  onPickDay,
  onSetFilterPeriod,
  onToggleCardio,
  onToggleGroup,
  onFlushQueue,
  onOpenSession,
  onRepeat,
  onSaveAsRoutine,
}: Props) {
  return (
    <>
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-[var(--muted-strong)]">
          Силовые: кг × повт (+5%). Кардио: км и минуты (темп).
        </p>
        <button
          type="button"
          className="shrink-0 rounded-lg bg-[var(--accent)] px-3 py-2 text-sm font-semibold text-white"
          onClick={() => onNewSession(filterDate ?? todayKey)}
        >
          Новая
        </button>
      </div>

      <section className="rounded-2xl border border-[rgba(13,115,119,0.14)] bg-white p-4">
        <div className="mb-2 flex items-center justify-between gap-2">
          <button
            type="button"
            className="rounded-full px-2 py-1 text-sm text-[var(--muted)] hover:bg-[var(--accent-soft)]"
            onClick={onCalPrev}
          >
            ←
          </button>
          <p className="text-sm font-semibold text-[var(--foreground)]">
            {formatMonthTitle(calYear, calMonth)}
          </p>
          <button
            type="button"
            className="rounded-full px-2 py-1 text-sm text-[var(--muted)] hover:bg-[var(--accent-soft)]"
            onClick={onCalNext}
          >
            →
          </button>
        </div>
        {monthSummary ? (
          <p className="mb-2 text-xs text-[var(--muted)]">
            {monthSummary.sessionCount} трен. · {formatWorkoutLoad(monthSummary.tonnage)} кг·повт
            {monthSummary.cardioDistanceKm > 0
              ? ` · ${formatDistanceKm(monthSummary.cardioDistanceKm)} км`
              : ""}
          </p>
        ) : null}
        <div className="grid grid-cols-7 gap-0.5 text-center text-[0.65rem] font-semibold uppercase tracking-wide text-[var(--muted)]">
          {["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"].map((d) => (
            <div key={d} className="py-1">
              {d}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-0.5">
          {getMonthGrid(calYear, calMonth).map((day, i) => {
            if (!day) return <div key={`e-${i}`} />;
            const count = calMarked[day] ?? 0;
            const selected = filterPeriod === "day" && filterDate === day;
            return (
              <button
                key={day}
                type="button"
                className={`relative rounded-lg py-1.5 text-sm tabular-nums ${
                  selected
                    ? "bg-teal-700 font-semibold text-white"
                    : count > 0
                      ? "bg-teal-50 font-medium text-teal-900 hover:bg-teal-100"
                      : "text-[var(--muted-strong)] hover:bg-[var(--surface-mist)]"
                }`}
                onClick={() => onPickDay(day)}
              >
                {Number(day.slice(8, 10))}
                {count > 0 ? (
                  <span
                    className={`absolute bottom-0.5 left-1/2 h-1 w-1 -translate-x-1/2 rounded-full ${
                      selected ? "bg-white" : "bg-teal-600"
                    }`}
                  />
                ) : null}
              </button>
            );
          })}
        </div>
      </section>

      <section className="rounded-2xl border border-[rgba(13,115,119,0.14)] bg-white p-3">
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
          Фильтр списка
        </p>
        <div className="flex flex-wrap gap-1.5">
          {(
            [
              ["all", "Все"],
              ["week", "Неделя"],
              ["month", "Месяц"],
              ["day", "День"],
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              type="button"
              className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                filterPeriod === key ? "bg-teal-700 text-white" : "bg-[var(--accent-soft)] text-[var(--muted-strong)]"
              }`}
              onClick={() => onSetFilterPeriod(key)}
            >
              {label}
            </button>
          ))}
          <button
            type="button"
            className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
              filterCardio ? "bg-teal-700 text-white" : "bg-[var(--accent-soft)] text-[var(--muted-strong)]"
            }`}
            onClick={onToggleCardio}
          >
            Кардио
          </button>
        </div>
        <div className="mt-2 flex flex-wrap gap-1">
          {MUSCLE_GROUPS.filter((g) => g.key !== "cardio").map((g) => {
            const on = filterGroups.includes(g.key);
            return (
              <button
                key={g.key}
                type="button"
                className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${
                  on ? "bg-teal-700 text-white" : "bg-[var(--surface-mist)] text-[var(--muted-strong)]"
                }`}
                onClick={() => onToggleGroup(g.key)}
              >
                {g.label}
              </button>
            );
          })}
        </div>
      </section>

      {insights ? (
        <section className="rounded-2xl border border-[rgba(13,115,119,0.14)] bg-white p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
            Неделя {formatDateShort(insights.weekStart)}–{formatDateShort(insights.weekEnd)}
          </p>
          <p className="mt-1 text-2xl font-semibold tabular-nums text-[var(--foreground)]">
            {formatWorkoutLoad(insights.weeklyTotal)}{" "}
            <span className="text-sm font-normal text-[var(--muted)]">кг·повт</span>
            {formatWorkoutTrend(insights.weekTrendPct) ? (
              <span className="ml-2 text-sm font-medium text-teal-800">
                {formatWorkoutTrend(insights.weekTrendPct)} к пред.
              </span>
            ) : null}
          </p>
          {(insights.weeklyCardioKm ?? 0) > 0 ? (
            <p className="text-sm tabular-nums text-[var(--muted-strong)]">
              Кардио {formatDistanceKm(insights.weeklyCardioKm!)} км
              {formatWorkoutTrend(insights.weekCardioTrendPct) ? (
                <span className="ml-2 text-xs text-teal-800">
                  {formatWorkoutTrend(insights.weekCardioTrendPct)}
                </span>
              ) : null}
            </p>
          ) : null}
          <p className="text-xs text-[var(--muted)]">{insights.sessionCount} тренировок</p>
          {Object.keys(insights.weeklyByGroup).length > 0 ? (
            <div className="mt-2 flex flex-wrap gap-2">
              {Object.entries(insights.weeklyByGroup).map(([key, g]) => (
                <span
                  key={key}
                  className="rounded-full bg-[var(--accent-soft)] px-2.5 py-1 text-xs font-medium text-[var(--muted-strong)]"
                >
                  {g.label}: {formatWorkoutLoad(g.load)}
                </span>
              ))}
            </div>
          ) : null}
          {insights.monthStart ? (
            <div className="mt-3 border-t border-[rgba(13,115,119,0.08)] pt-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
                Месяц {insights.monthStart.slice(0, 7)}
              </p>
              <p className="mt-1 text-lg font-semibold tabular-nums text-[var(--foreground)]">
                {formatWorkoutLoad(insights.monthlyTotal ?? 0)}{" "}
                <span className="text-sm font-normal text-[var(--muted)]">кг·повт</span>
                {formatWorkoutTrend(insights.monthTrendPct) ? (
                  <span className="ml-2 text-sm font-medium text-teal-800">
                    {formatWorkoutTrend(insights.monthTrendPct)}
                  </span>
                ) : null}
              </p>
              {(insights.monthlyCardioKm ?? 0) > 0 ? (
                <p className="text-sm text-[var(--muted-strong)]">
                  Кардио {formatDistanceKm(insights.monthlyCardioKm!)} км
                </p>
              ) : null}
              <p className="text-xs text-[var(--muted)]">
                {insights.monthlySessionCount ?? 0} тренировок
              </p>
            </div>
          ) : null}
        </section>
      ) : null}

      {queuedSets > 0 ? (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950">
          <p className="min-w-0 font-medium">
            {queuedSets === 1
              ? "1 подход ждёт сеть"
              : `${queuedSets} подхода ждут сеть`}
          </p>
          <button
            type="button"
            className="shrink-0 rounded-lg bg-amber-900/10 px-3 py-1 text-xs font-semibold hover:bg-amber-900/15"
            onClick={onFlushQueue}
          >
            Отправить
          </button>
        </div>
      ) : null}
      {error ? <p className="text-sm text-red-600">{error}</p> : null}

      {loading ? <p className="text-sm text-[var(--muted)]">Загрузка…</p> : null}

      {!loading && sessions.length === 0 && !creating ? (
        <p className="rounded-2xl border border-dashed border-[rgba(13,115,119,0.22)] p-6 text-center text-sm text-[var(--muted-strong)]">
          {filterPeriod !== "all" || filterGroups.length || filterCardio
            ? "Нет тренировок по фильтру."
            : "Пока нет тренировок. Создайте первую и отметьте вид / группы."}
          {filterPeriod === "day" && filterDate ? (
            <>
              {" "}
              <button
                type="button"
                className="font-semibold text-teal-800"
                onClick={() => onNewSession(filterDate)}
              >
                Создать на {formatDateShort(filterDate)}
              </button>
            </>
          ) : null}
        </p>
      ) : null}

      <ul className="flex flex-col gap-2">
        {sessions.map((s) => (
          <li
            key={s.id}
            className="flex items-stretch gap-2 rounded-2xl border border-[rgba(13,115,119,0.14)] bg-white"
          >
            <button
              type="button"
              className="flex min-w-0 flex-1 items-center justify-between gap-3 px-4 py-3 text-left hover:bg-[var(--surface-mist)]"
              onClick={() => onOpenSession(s.id)}
            >
              <div className="min-w-0">
                <p className="font-semibold text-[var(--foreground)]">{formatDateWords(s.date)}</p>
                <p className="truncate text-sm text-[var(--muted-strong)]">{s.muscleLabels.join(" · ")}</p>
                <p className="text-xs text-[var(--muted)]">
                  {s.exerciseCount} упр. · {s.setCount}{" "}
                  {s.cardioOnly ? "отр." : "подх."}
                </p>
              </div>
              <p className="text-lg font-semibold tabular-nums text-[var(--foreground)]">
                {s.cardioOnly
                  ? s.cardioDistanceKm > 0
                    ? `${formatDistanceKm(s.cardioDistanceKm)} км`
                    : formatDurationMinutes(s.cardioDurationSec)
                  : formatWorkoutLoad(s.totalLoad)}
              </p>
            </button>
            <button
              type="button"
              disabled={busy}
              className="shrink-0 border-l border-[rgba(13,115,119,0.08)] px-2.5 text-xs font-semibold text-teal-800 hover:bg-teal-50 disabled:opacity-40"
              onClick={() => onRepeat(s.id)}
            >
              Повторить
            </button>
            <button
              type="button"
              disabled={busy}
              className="shrink-0 border-l border-[rgba(13,115,119,0.08)] px-2.5 text-xs font-semibold text-[var(--muted-strong)] hover:bg-[var(--surface-mist)] disabled:opacity-40"
              title="Сохранить как шаблон"
              onClick={() =>
                onSaveAsRoutine(s.id, s.note?.trim() || s.muscleLabels.join(" · "))
              }
            >
              Шаблон
            </button>
          </li>
        ))}
      </ul>
    </>
  );
}
