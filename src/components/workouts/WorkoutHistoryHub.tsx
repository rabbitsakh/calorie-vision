"use client";

import { SceneSkeleton } from "@/components/SceneSkeleton";
import { GymCollectionWear } from "@/components/workouts/GymCollectionWear";
import { LeverRecoveryStrip } from "@/components/workouts/LeverRecoveryStrip";
import { LeverStreakStrip } from "@/components/workouts/LeverStreakStrip";
import {
  formatDateShort,
  formatDateWords,
  formatMonthTitle,
  getMonthGrid,
} from "@/lib/dates";
import { formatDistanceKm } from "@/lib/workouts/cardio";
import { formatWorkoutLoad, formatWorkoutTrend } from "@/lib/workouts/format";
import { historySessionLoad } from "@/lib/workouts/history-card";
import { MUSCLE_GROUPS, type MuscleGroupKey } from "@/lib/workouts/muscle-groups";
import { MuscleRecoveryCard } from "@/components/workouts/MuscleRecoveryCard";
import type { MuscleRecoveryMap } from "@/lib/workouts/muscle-volume";

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
  /** Exercises that set a new PR in this session (Wave V). */
  prCount?: number;
  clockStatus?: "idle" | "running" | "paused" | "finished" | null;
  elapsedLabel?: string | null;
  energyLabel?: string | null;
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
  muscleMap?: MuscleRecoveryMap | null;
};

type Props = {
  todayKey: string;
  sessions: HistorySessionRow[];
  loading: boolean;
  error: string | null;
  creating: boolean;
  busy: boolean;
  queuedSets: number;
  /** T4: brief flush summary when queue clears. */
  flushSummary?: string | null;
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
  /** Finished sessions: pass `summary: true` for overlay, else open editor. */
  onOpenSession: (id: string, opts?: { summary?: boolean }) => void;
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
  flushSummary = null,
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
    <div className="gym-hub-scene">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-[var(--muted-strong)]">Календарь и список тренировок.</p>
        <button
          type="button"
          className="gym-primary shrink-0"
          onClick={() => onNewSession(filterDate ?? todayKey)}
        >
          Новая
        </button>
      </div>
      <LeverStreakStrip className="mt-2" />
      {/* P: recovery strip; R8: collection wear on History hub */}
      <LeverRecoveryStrip className="mt-1.5" />
      <GymCollectionWear className="mt-1.5" />

      <section className="gym-plane">
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
            {monthSummary.sessionCount} трен. · {formatWorkoutLoad(monthSummary.tonnage)} кг × повторы
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
        <div className="gym-cal-grid">
          {getMonthGrid(calYear, calMonth).map((day, i) => {
            if (!day) return <div key={`e-${i}`} className="gym-cal-pad" />;
            const count = calMarked[day] ?? 0;
            const selected = filterPeriod === "day" && filterDate === day;
            const dayNum = Number(day.slice(8, 10));
            return (
              <button
                key={day}
                type="button"
                className={`gym-cal-day${selected ? " is-selected" : ""}${count > 0 ? " has-session" : ""}`}
                aria-pressed={selected}
                aria-label={
                  count > 0
                    ? `${dayNum}, ${count === 1 ? "есть тренировка" : `тренировок: ${count}`}`
                    : String(dayNum)
                }
                onClick={() => onPickDay(day)}
              >
                <span className="gym-cal-day__num">{dayNum}</span>
                <span className={`gym-cal-day__mark${count > 0 ? " is-on" : ""}`} aria-hidden />
              </button>
            );
          })}
        </div>
      </section>

      <section className="gym-plane !p-3">
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
          Фильтр списка
        </p>
        <div className="gym-chart-switch">
          {(
            [
              ["week", "Неделя"],
              ["month", "Месяц"],
              ["all", "Всё"],
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              type="button"
              className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                filterPeriod === key ? "bg-[var(--accent)] text-white" : "bg-[var(--accent-soft)] text-[var(--muted-strong)]"
              }`}
              onClick={() => onSetFilterPeriod(key)}
            >
              {label}
            </button>
          ))}
        </div>
        <details className="mt-2">
          <summary className="min-h-11 cursor-pointer text-sm font-semibold text-[var(--muted-strong)]">
            Группы и кардио
          </summary>
        <div className="mt-2 flex flex-wrap gap-1.5">
          <button
            type="button"
            className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
              filterCardio ? "bg-[var(--accent)] text-white" : "bg-[var(--accent-soft)] text-[var(--muted-strong)]"
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
                  on ? "bg-[var(--accent)] text-white" : "bg-[var(--surface-mist)] text-[var(--muted-strong)]"
                }`}
                onClick={() => onToggleGroup(g.key)}
              >
                {g.label}
              </button>
            );
          })}
        </div>
        </details>
      </section>

      {insights ? (
        <section className="gym-plane">
          <p className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
            Неделя {formatDateShort(insights.weekStart)}–{formatDateShort(insights.weekEnd)}
          </p>
          <p className="mt-1 text-2xl font-semibold tabular-nums text-[var(--foreground)]">
            {formatWorkoutLoad(insights.weeklyTotal)}{" "}
            <span className="text-sm font-normal text-[var(--muted)]">кг × повторы</span>
            {formatWorkoutTrend(insights.weekTrendPct) ? (
              <span className="ml-2 text-sm font-medium text-[var(--accent-ink)]">
                {formatWorkoutTrend(insights.weekTrendPct)} к пред.
              </span>
            ) : null}
          </p>
          {(insights.weeklyCardioKm ?? 0) > 0 ? (
            <p className="text-sm tabular-nums text-[var(--muted-strong)]">
              Кардио {formatDistanceKm(insights.weeklyCardioKm!)} км
              {formatWorkoutTrend(insights.weekCardioTrendPct) ? (
                <span className="ml-2 text-xs text-[var(--accent-ink)]">
                  {formatWorkoutTrend(insights.weekCardioTrendPct)}
                </span>
              ) : null}
            </p>
          ) : null}
          <p className="text-xs text-[var(--muted)]">{insights.sessionCount} тренировок</p>
          {insights.muscleMap && insights.muscleMap.rows.length > 0 ? (
            <div className="mt-3">
              <MuscleRecoveryCard map={insights.muscleMap} plain />
            </div>
          ) : Object.keys(insights.weeklyByGroup).length > 0 ? (
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
            <div className="mt-3 border-t border-[var(--border-hairline)] pt-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
                Месяц {insights.monthStart.slice(0, 7)}
              </p>
              <p className="mt-1 text-lg font-semibold tabular-nums text-[var(--foreground)]">
                {formatWorkoutLoad(insights.monthlyTotal ?? 0)}{" "}
                <span className="text-sm font-normal text-[var(--muted)]">кг × повторы</span>
                {formatWorkoutTrend(insights.monthTrendPct) ? (
                  <span className="ml-2 text-sm font-medium text-[var(--accent-ink)]">
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
            {flushSummary
              ? flushSummary
              : queuedSets === 1
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
      ) : flushSummary ? (
        <div
          className="rounded-xl border border-[var(--accent)]/25 bg-[var(--accent-soft)] px-3 py-2 text-sm font-medium text-[var(--accent-ink)]"
          role="status"
        >
          {flushSummary}
        </div>
      ) : null}
      {error ? <p className="text-sm text-red-600">{error}</p> : null}

      {loading ? <SceneSkeleton inline label="Загрузка истории…" /> : null}

      {!loading && sessions.length === 0 && !creating ? (
        <div className="scene-empty">
          <p className="scene-empty__title">
            {filterPeriod !== "all" || filterGroups.length || filterCardio
              ? "Нет тренировок по фильтру"
              : "Пока нет тренировок"}
          </p>
          {!(filterPeriod !== "all" || filterGroups.length || filterCardio) ? (
            <p className="scene-empty__hint">Создайте первую и отметьте вид / группы.</p>
          ) : null}
          {filterPeriod === "day" && filterDate ? (
            <button
              type="button"
              className="btn btn-on-tint text-sm text-[var(--accent-ink)]"
              onClick={() => onNewSession(filterDate)}
            >
              Создать на {formatDateShort(filterDate)}
            </button>
          ) : null}
        </div>
      ) : null}

      <ul className="flex flex-col gap-2">
        {sessions.map((s) => {
          const load = historySessionLoad(s);
          return (
          <li
            key={s.id}
            className="gym-session-card"
          >
            <button
              type="button"
              className="gym-session-card__open"
              onClick={() => onOpenSession(s.id, { summary: false })}
            >
              <div className="gym-session-card__copy">
                <div className="gym-session-card__head">
                  <p className="gym-session-card__date">{formatDateWords(s.date)}</p>
                  {s.clockStatus === "finished" ? (
                    <span className="gym-session-card__badge">
                      итог{s.elapsedLabel ? ` · ${s.elapsedLabel}` : ""}
                    </span>
                  ) : s.clockStatus === "running" || s.clockStatus === "paused" ? (
                    <span className="gym-session-card__badge gym-session-card__badge--live">
                      {s.clockStatus === "paused" ? "пауза" : "идёт"}
                    </span>
                  ) : null}
                  {(s.prCount ?? 0) > 0 ? (
                    <span className="gym-session-card__badge gym-session-card__badge--live">
                      {s.prCount === 1 ? "1 рекорд" : `${s.prCount} рекорда`}
                    </span>
                  ) : null}
                </div>
                <p className="gym-session-card__title">
                  {s.muscleLabels.join(" · ") || "Тренировка"}
                </p>
                <p className="gym-session-card__detail">
                  {s.exerciseCount} упр. · {s.setCount}{" "}
                  {s.cardioOnly ? "отр." : "подх."}
                </p>
                {s.energyLabel ? <p className="gym-energy-line">{s.energyLabel}</p> : null}
              </div>
            </button>
            <div className="gym-session-card__rail">
              <p className="gym-session-card__load">
                <span className="gym-session-card__load-value">{load.value}</span>
                <span className="gym-session-card__load-unit">{load.unit}</span>
              </p>
              {s.clockStatus === "finished" ? (
                <button
                  type="button"
                  onClick={() => onOpenSession(s.id, { summary: true })}
                >
                  Итог
                </button>
              ) : null}
              <button
                type="button"
                disabled={busy}
                className="is-accent"
                onClick={() => onRepeat(s.id)}
              >
                Повторить
              </button>
              <button
                type="button"
                disabled={busy}
                title="Сохранить как шаблон"
                onClick={() =>
                  onSaveAsRoutine(s.id, s.note?.trim() || s.muscleLabels.join(" · "))
                }
              >
                Шаблон
              </button>
            </div>
          </li>
          );
        })}
      </ul>
    </div>
  );
}
