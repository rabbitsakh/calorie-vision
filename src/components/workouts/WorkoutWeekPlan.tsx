"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { dayHeroAtmosphereClass } from "@/lib/day-atmosphere";
import { hourInTimezone } from "@/lib/meal-type";
import { withBasePath } from "@/lib/paths";
import { useTimezone } from "@/lib/use-timezone";
import { formatDistanceKm, formatDurationMinutes } from "@/lib/workouts/cardio";
import { WEEKDAY_LABELS_RU } from "@/lib/workouts/weekdays";
import type { SerializedRoutine } from "@/lib/workouts/routines";

type PlanResponse = {
  date: string;
  weekday: number;
  weekdayLabel: string;
  today: SerializedRoutine[];
  week: Array<{ weekday: number; label: string; routines: SerializedRoutine[] }>;
};

export type TodaySessionCard = {
  id: string;
  muscleLabels: string[];
  exerciseCount: number;
  setCount: number;
  totalLoad: number;
  cardioOnly: boolean;
  cardioDistanceKm: number;
  cardioDurationSec: number;
  clockStatus?: "idle" | "running" | "paused" | "finished";
  elapsedLabel?: string;
};

export type LastWorkoutRepeat = {
  id: string;
  label: string;
  hint: string;
};

type Props = {
  todayKey: string;
  sessions: TodaySessionCard[];
  /** No history at all — first-ever gym open. */
  firstWorkout?: boolean;
  /** One-tap clone of the most recent finished session. */
  lastRepeat?: LastWorkoutRepeat | null;
  /** Open the week fold (e.g. after saving a template). */
  preferWeekOpen?: boolean;
  onOpenSession: (id: string) => void;
  onStartBlank: () => void;
  onRepeatLast?: (sessionId: string) => void;
  onStartRoutine: (routineId: string) => void;
  onEditRoutine: (routineId: string) => void;
  /** Create a new template, optionally prefilled for a weekday (0=Mon … 6=Sun). */
  onCreatePlanDay?: (weekday?: number) => void;
  onGoTemplates: () => void;
  busy?: boolean;
};

function formatLoad(value: number): string {
  if (!Number.isFinite(value)) return "0";
  return value >= 100 ? Math.round(value).toLocaleString("ru-RU") : String(Math.round(value * 10) / 10);
}

function statusLabel(status: TodaySessionCard["clockStatus"]): string {
  if (status === "running") return "Идёт";
  if (status === "paused") return "Пауза";
  if (status === "finished") return "Готово";
  return "Черновик";
}

function sessionMetric(s: TodaySessionCard): string {
  if (s.cardioOnly) {
    if (s.cardioDistanceKm > 0) return `${formatDistanceKm(s.cardioDistanceKm)} км`;
    if (s.cardioDurationSec > 0) return formatDurationMinutes(s.cardioDurationSec);
    return "—";
  }
  return s.totalLoad > 0 ? `${formatLoad(s.totalLoad)} кг·повт` : "—";
}

/**
 * D5: Today hub as one day scene (atmosphere + actions), not a card stack.
 */
export function WorkoutWeekPlan({
  todayKey,
  sessions,
  firstWorkout = false,
  lastRepeat = null,
  preferWeekOpen = false,
  onOpenSession,
  onStartBlank,
  onRepeatLast,
  onStartRoutine,
  onEditRoutine,
  onCreatePlanDay,
  onGoTemplates,
  busy,
}: Props) {
  const timezone = useTimezone();
  const [data, setData] = useState<PlanResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [weekOpen, setWeekOpen] = useState(true);

  useEffect(() => {
    if (preferWeekOpen) setWeekOpen(true);
  }, [preferWeekOpen]);

  const atmosphere = useMemo(
    () => dayHeroAtmosphereClass(hourInTimezone(new Date(), timezone)),
    [timezone],
  );

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const resp = await fetch(withBasePath(`/api/workouts/plan?date=${todayKey}`));
      const json = (await resp.json()) as PlanResponse & { error?: string };
      if (!resp.ok) throw new Error(json.error || "Ошибка");
      setData(json);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не загрузилось");
    } finally {
      setLoading(false);
    }
  }, [todayKey]);

  useEffect(() => {
    void load();
  }, [load]);

  const active = sessions.find(
    (s) => s.clockStatus === "running" || s.clockStatus === "paused",
  );
  const drafts = sessions.filter(
    (s) => !s.clockStatus || s.clockStatus === "idle",
  );
  const finished = sessions.filter((s) => s.clockStatus === "finished");
  const planned = data?.today ?? [];
  const isFirstEmpty =
    firstWorkout && !active && drafts.length === 0 && finished.length === 0;
  const canRepeat =
    Boolean(lastRepeat && onRepeatLast) && !active && drafts.length === 0;
  /** Under «Новая» when nothing done yet today; beside «+ Ещё одна» after a finish. */
  const showRepeatInStart = canRepeat && finished.length === 0;
  const showRepeatInFinished = canRepeat && finished.length > 0;

  const sceneHeadline = active
    ? `${statusLabel(active.clockStatus)} · ${active.muscleLabels.join(" · ") || "Тренировка"}`
    : drafts.length > 0
      ? "Есть незавершённая"
      : finished.length > 0
        ? "Уже потренировались"
        : isFirstEmpty
          ? "Первая тренировка"
          : "Начать сегодня";

  const sceneMeta = active
    ? [
        active.elapsedLabel,
        `${active.exerciseCount} упр.`,
        sessionMetric(active),
      ]
        .filter(Boolean)
        .join(" · ")
    : data
      ? data.weekdayLabel
      : "Зал";

  return (
    <div className="gym-day">
      <section
        className={`day-hero day-hero--scene ${atmosphere}${active ? " day-hero--live" : ""}`}
        aria-label="Сводка зала на сегодня"
      >
        <div className="day-hero-glow" aria-hidden />
        <div className={`relative flex items-center gap-4 px-5 py-7 md:px-7 md:py-8 ${active ? "gym-console-active" : ""}`}>
          <div className="min-w-0 flex-1">
            <p className={`text-[0.72rem] font-semibold uppercase tracking-[0.22em] ${active ? "gym-live-pulse text-teal-100/90" : "text-[var(--accent-ink)]/70"}`}>
              {active ? "Сейчас" : "Сегодня"}
              {data ? ` · ${data.weekdayLabel}` : ""}
            </p>
            <p className={`font-display mt-2.5 text-[1.45rem] font-semibold leading-snug tracking-tight sm:text-[1.7rem] ${active ? "text-white" : "text-[var(--foreground)]"}`}>
              {sceneHeadline}
            </p>
            <p className={`mt-2.5 text-[0.95rem] font-medium ${active ? "text-teal-50/85" : "text-[var(--muted-strong)]"}`}>
              {sceneMeta}
            </p>
          </div>
          {active ? (
            <button
              type="button"
              disabled={busy}
              className="shrink-0 rounded-[1rem] bg-white px-5 py-3 text-sm font-bold text-[var(--accent-ink)] shadow-[0_8px_24px_rgba(0,0,0,0.18)] disabled:opacity-40"
              onClick={() => onOpenSession(active.id)}
            >
              В зал
            </button>
          ) : null}
        </div>
      </section>

      <div className="gym-today-feed">
        {active ? (
          <div className="gym-today-row">
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase tracking-wide text-teal-800">
                Сейчас · {statusLabel(active.clockStatus)}
              </p>
              <p className="mt-0.5 font-semibold text-[var(--foreground)]">
                {active.muscleLabels.join(" · ") || "Тренировка"}
              </p>
              <p className="text-sm text-[var(--muted-strong)]">
                {active.exerciseCount} упр. · {sessionMetric(active)}
              </p>
            </div>
            <button
              type="button"
              disabled={busy}
              className="shrink-0 rounded-[var(--radius-control)] bg-teal-700 px-3 py-2 text-sm font-semibold text-white disabled:opacity-40"
              onClick={() => onOpenSession(active.id)}
            >
              Продолжить
            </button>
          </div>
        ) : null}

        {!active && drafts.length > 0 ? (
          <div className="gym-today-block">
            <p className="text-xs font-semibold uppercase tracking-wide text-amber-900">
              Незавершённые сегодня
            </p>
            <ul className="mt-2 space-y-2">
              {drafts.map((s) => (
                <li key={s.id} className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate font-semibold text-[var(--foreground)]">
                      {s.muscleLabels.join(" · ") || "Тренировка"}
                    </p>
                    <p className="text-xs text-[var(--muted)]">
                      {s.exerciseCount} упр. · {s.setCount} подх.
                    </p>
                  </div>
                  <button
                    type="button"
                    disabled={busy}
                    className="shrink-0 rounded-[var(--radius-control)] bg-teal-700 px-3 py-2 text-sm font-semibold text-white disabled:opacity-40"
                    onClick={() => onOpenSession(s.id)}
                  >
                    Открыть
                  </button>
                </li>
              ))}
            </ul>
            <button
              type="button"
              disabled={busy}
              className="mt-3 text-sm font-medium text-teal-800 disabled:opacity-40"
              onClick={onStartBlank}
            >
              + Новая вместо этого
            </button>
          </div>
        ) : null}

        {!active && drafts.length === 0 ? (
          <div className="gym-today-block">
            <p className="text-sm font-semibold text-[var(--foreground)]">
              {isFirstEmpty ? "Первая тренировка" : "Начать тренировку"}
            </p>
            <p className="mt-1 text-sm text-[var(--muted)]">
              {isFirstEmpty
                ? "Один тап — и вы в зале. Подходы и кардио можно добавить сразу."
                : "Пустая сессия на сегодня — упражнения добавите сами."}
            </p>
            <button
              type="button"
              disabled={busy}
              className="mt-3 w-full rounded-[var(--radius-control)] bg-[var(--accent)] py-3 text-base font-bold text-white disabled:opacity-40"
              onClick={onStartBlank}
            >
              {isFirstEmpty ? "Начать тренировку" : "Новая тренировка"}
            </button>

            {showRepeatInStart && lastRepeat && onRepeatLast ? (
              <div className="mt-3">
                <button
                  type="button"
                  disabled={busy}
                  className="w-full rounded-[var(--radius-control)] border border-teal-200 bg-teal-50/80 py-3 text-base font-semibold text-teal-900 disabled:opacity-40"
                  onClick={() => onRepeatLast(lastRepeat.id)}
                >
                  {busy ? "Копируем…" : lastRepeat.label}
                </button>
                <p className="mt-1.5 text-center text-xs text-[var(--muted)]">
                  {lastRepeat.hint}
                </p>
              </div>
            ) : null}

            {isFirstEmpty ? null : loading ? (
              <p className="mt-4 text-sm text-[var(--muted)]">Загрузка плана…</p>
            ) : error ? (
              <p className="mt-4 text-sm text-red-600">{error}</p>
            ) : planned.length > 0 ? (
              <div className="mt-4 border-t border-[var(--border-hairline)] pt-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
                  Или по плану на сегодня
                </p>
                <ul className="mt-2 space-y-2">
                  {planned.map((r) => (
                    <li
                      key={r.id}
                      className="flex items-center justify-between gap-2 rounded-[var(--radius-md)] bg-[var(--surface-mist)]/80 px-3 py-2"
                    >
                      <div className="min-w-0">
                        <p className="truncate font-semibold text-[var(--foreground)]">
                          {r.planLabel ? (
                            <span className="mr-1.5 rounded bg-teal-700 px-1.5 py-0.5 text-xs text-white">
                              {r.planLabel}
                            </span>
                          ) : null}
                          {r.name}
                        </p>
                        <p className="truncate text-xs text-[var(--muted)]">
                          {r.exerciseCount} упр. · {r.muscleLabels.join(" · ")}
                        </p>
                      </div>
                      <button
                        type="button"
                        disabled={busy}
                        className="shrink-0 rounded-[var(--radius-control)] bg-teal-700 px-3 py-2 text-sm font-semibold text-white disabled:opacity-40"
                        onClick={() => onStartRoutine(r.id)}
                      >
                        Старт
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            ) : (
              <div className="mt-4 border-t border-[var(--border-hairline)] pt-4">
                <p className="text-sm text-[var(--muted-strong)]">
                  На сегодня в плане пусто. Составьте шаблон и отметьте дни недели — он появится здесь.
                </p>
                <button
                  type="button"
                  className="mt-2 text-sm font-semibold text-teal-800 underline-offset-2 hover:underline"
                  onClick={() =>
                    onCreatePlanDay
                      ? onCreatePlanDay(data?.weekday)
                      : onGoTemplates()
                  }
                >
                  Составить план на неделю
                </button>
              </div>
            )}
          </div>
        ) : null}

        {finished.length > 0 ? (
          <div className="gym-today-block">
            <p className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
              Уже сегодня
            </p>
            <ul className="mt-2 space-y-2">
              {finished.map((s) => (
                <li key={s.id} className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate font-medium text-[var(--foreground)]">
                      {s.muscleLabels.join(" · ") || "Тренировка"}
                    </p>
                    <p className="text-xs text-[var(--muted)]">{sessionMetric(s)}</p>
                  </div>
                  <button
                    type="button"
                    className="shrink-0 text-sm font-semibold text-teal-800"
                    onClick={() => onOpenSession(s.id)}
                  >
                    Итог
                  </button>
                </li>
              ))}
            </ul>
            {active || drafts.length > 0 ? null : (
              <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2">
                <button
                  type="button"
                  disabled={busy}
                  className="text-sm font-medium text-teal-800 disabled:opacity-40"
                  onClick={onStartBlank}
                >
                  + Ещё одна сегодня
                </button>
                {showRepeatInFinished && lastRepeat && onRepeatLast ? (
                  <button
                    type="button"
                    disabled={busy}
                    className="text-sm font-semibold text-teal-900 disabled:opacity-40"
                    onClick={() => onRepeatLast(lastRepeat.id)}
                    title={lastRepeat.hint}
                  >
                    {busy ? "Копируем…" : lastRepeat.label}
                  </button>
                ) : null}
              </div>
            )}
          </div>
        ) : null}

        {isFirstEmpty ? null : (
          <details
            className="gym-today-fold group"
            open={weekOpen}
            onToggle={(e) => setWeekOpen((e.target as HTMLDetailsElement).open)}
          >
            <summary className="gym-today-fold-summary">
              <span className="min-w-0">
                <span className="block text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
                  План на неделю
                </span>
                {!weekOpen ? (
                  <span className="mt-0.5 block text-sm text-[var(--muted)]">
                    {planned.length > 0
                      ? `Сегодня: ${planned.map((r) => r.name).join(", ")}`
                      : "Шаблоны по дням · нажмите, чтобы настроить"}
                  </span>
                ) : null}
              </span>
              <span
                className="shrink-0 text-[var(--muted)] transition-transform group-open:rotate-180"
                aria-hidden
              >
                ▾
              </span>
            </summary>
            <div className="gym-today-fold-body space-y-3">
              <p className="text-sm text-[var(--muted-strong)]">
                План = шаблоны с отмеченными днями. Нажмите день без записи — создадите шаблон;
                нажмите название — отредактируете.
              </p>
              {loading || !data ? (
                <p className="text-sm text-[var(--muted)]">…</p>
              ) : (
                <ul className="space-y-2">
                  {data.week.map((day) => (
                    <li
                      key={day.weekday}
                      className={`flex items-center gap-3 rounded-[var(--radius-md)] px-2 py-2 text-sm ${
                        day.weekday === data.weekday ? "bg-teal-50/70" : ""
                      }`}
                    >
                      <span
                        className={`w-8 shrink-0 font-semibold ${
                          day.weekday === data.weekday ? "text-teal-800" : "text-[var(--muted)]"
                        }`}
                      >
                        {WEEKDAY_LABELS_RU[day.weekday]}
                      </span>
                      <div className="min-w-0 flex-1">
                        {day.routines.length === 0 ? (
                          onCreatePlanDay ? (
                            <button
                              type="button"
                              className="text-left font-medium text-[var(--muted)] underline-offset-2 hover:text-teal-800 hover:underline"
                              onClick={() => onCreatePlanDay(day.weekday)}
                            >
                              + Назначить
                            </button>
                          ) : (
                            <span className="text-[var(--muted)]">—</span>
                          )
                        ) : (
                          day.routines.map((r) => (
                            <button
                              key={r.id}
                              type="button"
                              className="mr-2 text-left font-medium text-teal-900 underline-offset-2 hover:underline"
                              onClick={() => onEditRoutine(r.id)}
                            >
                              {r.planLabel ? `${r.planLabel}: ` : ""}
                              {r.name}
                            </button>
                          ))
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
              {onCreatePlanDay ? (
                <button
                  type="button"
                  className="text-sm font-semibold text-teal-800 underline-offset-2 hover:underline"
                  onClick={() => onCreatePlanDay()}
                >
                  + Новый шаблон в план
                </button>
              ) : null}
            </div>
          </details>
        )}
      </div>
    </div>
  );
}
