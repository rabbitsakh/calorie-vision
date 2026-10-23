"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { SceneSkeleton } from "@/components/SceneSkeleton";
import { GymCollectionWear } from "@/components/workouts/GymCollectionWear";
import { LeverStreakStrip } from "@/components/workouts/LeverStreakStrip";
import { LeverRecoveryStrip } from "@/components/workouts/LeverRecoveryStrip";
import { dayHeroAtmosphereClass } from "@/lib/day-atmosphere";
import { hourInTimezone } from "@/lib/meal-type";
import { withBasePath } from "@/lib/paths";
import { useTimezone } from "@/lib/use-timezone";
import { formatDistanceKm, formatDurationMinutes } from "@/lib/workouts/cardio";
import { resolveTodayPrimary } from "@/lib/workouts/today-primary";
import {
  planWeekdayFromDateKey,
  removeWeekdayFromList,
  WEEKDAY_LABELS_RU,
} from "@/lib/workouts/weekdays";
import type { SerializedRoutine } from "@/lib/workouts/routines";

type PlanRemoveUndo = {
  routineId: string;
  name: string;
  weekday: number;
  previousWeekdays: number[];
  dayLabel: string;
};

function PlanUndoToast({
  label,
  onUndo,
  onExpired,
}: {
  label: string;
  onUndo: () => void;
  onExpired: () => void;
}) {
  useEffect(() => {
    const t = window.setTimeout(onExpired, 4500);
    return () => window.clearTimeout(t);
  }, [onExpired]);
  return (
    <div className="fixed inset-x-0 bottom-[max(5.5rem,env(safe-area-inset-bottom))] z-40 mx-auto flex max-w-lg items-center justify-between gap-3 rounded-xl bg-[var(--accent-ink)] px-4 py-3 text-sm text-white shadow-lg">
      <span className="min-w-0 truncate">Убрано: {label}</span>
      <button
        type="button"
        className="shrink-0 rounded-lg bg-white/20 px-3 py-1 text-xs font-semibold hover:bg-white/30"
        onClick={onUndo}
      >
        Отменить
      </button>
    </div>
  );
}

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
  /** Cached routines for offline plan (Wave Q). */
  routinesFallback?: SerializedRoutine[];
  /** Open the week fold (e.g. after saving a template). */
  preferWeekOpen?: boolean;
  /** `summary: true` opens finish overlay; omit/false opens editable session. */
  onOpenSession: (id: string, opts?: { summary?: boolean }) => void;
  onStartBlank: () => void;
  onRepeatLast?: (sessionId: string) => void;
  onStartRoutine: (routineId: string) => void;
  onEditRoutine: (routineId: string) => void;
  /** Create a new template, optionally prefilled for a weekday (0=Mon … 6=Sun). */
  onCreatePlanDay?: (weekday?: number) => void;
  /** After removing a day from a routine schedule (reload templates cache). */
  onPlanChanged?: () => void;
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
  routinesFallback = [],
  preferWeekOpen = false,
  onOpenSession,
  onStartBlank,
  onRepeatLast,
  onStartRoutine,
  onEditRoutine,
  onCreatePlanDay,
  onPlanChanged,
  onGoTemplates,
  busy,
}: Props) {
  const timezone = useTimezone();
  const [data, setData] = useState<PlanResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [weekOpen, setWeekOpen] = useState(false);
  const [removingKey, setRemovingKey] = useState<string | null>(null);
  const [planUndo, setPlanUndo] = useState<PlanRemoveUndo | null>(null);

  useEffect(() => {
    if (preferWeekOpen) setWeekOpen(true);
  }, [preferWeekOpen]);

  const atmosphere = useMemo(
    () => dayHeroAtmosphereClass(hourInTimezone(new Date(), timezone)),
    [timezone],
  );

  const planFromFallback = useCallback((): PlanResponse | null => {
    if (routinesFallback.length === 0) return null;
    const weekday = planWeekdayFromDateKey(todayKey);
    if (weekday == null) return null;
    const week = WEEKDAY_LABELS_RU.map((label, day) => ({
      weekday: day,
      label,
      routines: routinesFallback.filter((r) => r.weekdays.includes(day)),
    }));
    return {
      date: todayKey,
      weekday,
      weekdayLabel: WEEKDAY_LABELS_RU[weekday] ?? "",
      today: routinesFallback.filter((r) => r.weekdays.includes(weekday)),
      week,
    };
  }, [routinesFallback, todayKey]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const resp = await fetch(withBasePath(`/api/workouts/plan?date=${todayKey}`));
      const json = (await resp.json()) as PlanResponse & { error?: string };
      if (!resp.ok) throw new Error(json.error || "Ошибка");
      setData(json);
    } catch (err) {
      const fallback = planFromFallback();
      if (fallback) {
        setData(fallback);
        setError(null);
      } else {
        setError(err instanceof Error ? err.message : "Не загрузилось");
      }
    } finally {
      setLoading(false);
    }
  }, [todayKey, planFromFallback]);

  useEffect(() => {
    void load();
  }, [load]);

  const patchWeekdays = useCallback(async (routineId: string, weekdays: number[]) => {
    const resp = await fetch(withBasePath(`/api/workouts/routines/${routineId}`), {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ weekdays }),
    });
    const json = (await resp.json().catch(() => null)) as { error?: string } | null;
    if (!resp.ok) throw new Error(json?.error || "Не удалось обновить план");
  }, []);

  const removeFromDay = useCallback(
    async (routine: SerializedRoutine, weekday: number) => {
      const dayLabel = WEEKDAY_LABELS_RU[weekday] ?? String(weekday);
      const previousWeekdays = [...routine.weekdays];
      const nextWeekdays = removeWeekdayFromList(routine.weekdays, weekday);
      const key = `${routine.id}:${weekday}`;
      setRemovingKey(key);
      setError(null);
      try {
        await patchWeekdays(routine.id, nextWeekdays);
        setPlanUndo({
          routineId: routine.id,
          name: routine.name,
          weekday,
          previousWeekdays,
          dayLabel,
        });
        await load();
        onPlanChanged?.();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Не удалось убрать из плана");
      } finally {
        setRemovingKey(null);
      }
    },
    [load, onPlanChanged, patchWeekdays],
  );

  const undoPlanRemove = useCallback(async () => {
    if (!planUndo) return;
    const snapshot = planUndo;
    setPlanUndo(null);
    setError(null);
    try {
      await patchWeekdays(snapshot.routineId, snapshot.previousWeekdays);
      await load();
      onPlanChanged?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось вернуть в план");
      setPlanUndo(snapshot);
    }
  }, [planUndo, patchWeekdays, load, onPlanChanged]);

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

  const primary = resolveTodayPrimary({
    hasActive: Boolean(active),
    draftCount: drafts.length,
    finishedCount: finished.length,
    plannedCount: planned.length,
    firstEmpty: Boolean(isFirstEmpty),
  });

  const sceneHeadline = active
    ? `${statusLabel(active.clockStatus)} · ${active.muscleLabels.join(" · ") || "Тренировка"}`
    : drafts.length > 0
      ? "Есть незавершённая"
      : finished.length > 0
        ? "Уже потренировались"
        : primary === "rest"
          ? "День отдыха"
          : isFirstEmpty
            ? "Первая тренировка"
            : planned.length > 0
              ? "По плану сегодня"
              : "Начать сегодня";

  const sceneMeta = active
    ? [
        active.elapsedLabel,
        `${active.exerciseCount} упр.`,
        sessionMetric(active),
      ]
        .filter(Boolean)
        .join(" · ")
    : primary === "rest"
      ? "В плане нет тренировки — можно восстановиться или потренироваться вне плана"
      : data
        ? data.weekdayLabel
        : "Зал";

  return (
    <div className="gym-day">
      {planUndo ? (
        <PlanUndoToast
          label={`«${planUndo.name}» · ${planUndo.dayLabel}`}
          onUndo={() => void undoPlanRemove()}
          onExpired={() => setPlanUndo(null)}
        />
      ) : null}
      <section
        className={`day-hero day-hero--scene ${atmosphere}${active ? " day-hero--live" : ""}`}
        aria-label="Сводка зала на сегодня"
      >
        <div className="day-hero-glow" aria-hidden />
        <div className={`relative flex items-center gap-4 px-5 py-7 md:px-7 md:py-8 ${active ? "gym-console-active" : ""}`}>
          <div className="min-w-0 flex-1">
            <p className={`text-[0.72rem] font-semibold uppercase tracking-[0.22em] ${active ? "gym-live-pulse text-[var(--on-ink)]/90" : "text-[var(--accent-ink)]/70"}`}>
              {active ? "Сейчас" : primary === "rest" ? "Отдых" : "Сегодня"}
              {data ? ` · ${data.weekdayLabel}` : ""}
            </p>
            <p className={`font-display mt-2.5 text-[1.45rem] font-semibold leading-snug tracking-tight sm:text-[1.7rem] ${active ? "text-white" : "text-[var(--foreground)]"}`}>
              {sceneHeadline}
            </p>
            <p className={`mt-2.5 text-[0.95rem] font-medium ${active ? "text-[var(--on-ink)]/85" : "text-[var(--muted-strong)]"}`}>
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
              Продолжить
            </button>
          ) : primary === "open_draft" && drafts[0] ? (
            <button
              type="button"
              disabled={busy}
              className="shrink-0 rounded-[1rem] bg-[var(--accent)] px-5 py-3 text-sm font-bold text-white shadow-[0_8px_24px_rgba(13,115,119,0.28)] disabled:opacity-40"
              onClick={() => onOpenSession(drafts[0]!.id)}
            >
              Открыть
            </button>
          ) : primary === "start_plan" && planned[0] ? (
            <button
              type="button"
              disabled={busy}
              className="shrink-0 rounded-[1rem] bg-[var(--accent)] px-5 py-3 text-sm font-bold text-white shadow-[0_8px_24px_rgba(13,115,119,0.28)] disabled:opacity-40"
              onClick={() => onStartRoutine(planned[0]!.id)}
            >
              Старт
            </button>
          ) : primary === "blank_start" || isFirstEmpty ? (
            <button
              type="button"
              disabled={busy}
              className="shrink-0 rounded-[1rem] bg-[var(--accent)] px-5 py-3 text-sm font-bold text-white shadow-[0_8px_24px_rgba(13,115,119,0.28)] disabled:opacity-40"
              onClick={onStartBlank}
            >
              Старт
            </button>
          ) : primary === "rest" ? (
            <button
              type="button"
              disabled={busy}
              className="shrink-0 rounded-[1rem] border border-[var(--border-quiet)] bg-[var(--accent-soft)] px-4 py-3 text-sm font-bold text-[var(--accent-ink)] disabled:opacity-40"
              onClick={onStartBlank}
            >
              Вне плана
            </button>
          ) : primary === "finished" ? (
            <button
              type="button"
              disabled={busy}
              className="shrink-0 rounded-[1rem] bg-[var(--accent)] px-5 py-3 text-sm font-bold text-white shadow-[0_8px_24px_rgba(13,115,119,0.28)] disabled:opacity-40"
              onClick={onStartBlank}
            >
              Ещё
            </button>
          ) : null}
        </div>
      </section>

      {/* Levers / wear sit below the one primary CTA */}
      <div className="mt-2 flex flex-col gap-1.5 px-0.5">
        <LeverStreakStrip />
        <LeverRecoveryStrip />
        <GymCollectionWear />
      </div>

      <div className="gym-today-feed">
        {active ? (
          <div className="gym-today-row">
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase tracking-wide text-[var(--accent-ink)]">
                Сейчас · {statusLabel(active.clockStatus)}
              </p>
              <p className="mt-0.5 font-semibold text-[var(--foreground)]">
                {active.muscleLabels.join(" · ") || "Тренировка"}
              </p>
              <p className="text-sm text-[var(--muted-strong)]">
                {active.exerciseCount} упр. · {sessionMetric(active)}
                {active.elapsedLabel ? ` · ${active.elapsedLabel}` : ""}
              </p>
            </div>
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
                    className="shrink-0 rounded-[var(--radius-control)] bg-[var(--accent)] px-3 py-2 text-sm font-semibold text-white disabled:opacity-40"
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
              className="mt-3 text-sm font-medium text-[var(--accent-ink)] disabled:opacity-40"
              onClick={onStartBlank}
            >
              + Новая вместо этого
            </button>
          </div>
        ) : null}

        {!active && drafts.length === 0 ? (
          <div className="gym-today-block">
            {isFirstEmpty ? (
              <>
                <p className="text-sm font-semibold text-[var(--foreground)]">Первая тренировка</p>
                <p className="mt-1 text-sm text-[var(--muted)]">
                  Кнопка «Старт» выше — и вы в зале. Подходы и кардио можно добавить сразу.
                </p>
              </>
            ) : loading ? (
              <SceneSkeleton inline label="Загрузка плана…" />
            ) : error ? (
              <p className="text-sm text-red-600">{error}</p>
            ) : primary === "start_plan" && planned.length > 0 ? (
              <>
                <p className="text-sm font-semibold text-[var(--foreground)]">По плану на сегодня</p>
                <p className="mt-1 text-sm text-[var(--muted)]">
                  Один тап — старт шаблона. Неделю можно открыть ниже.
                </p>
                <ul className="mt-3 space-y-2">
                  {planned.map((r) => {
                    const removeKey =
                      data?.weekday != null ? `${r.id}:${data.weekday}` : null;
                    const removing = removeKey != null && removingKey === removeKey;
                    return (
                      <li
                        key={r.id}
                        className="flex items-center justify-between gap-2 rounded-[var(--radius-md)] bg-[var(--surface-mist)]/80 px-3 py-2"
                      >
                        <div className="min-w-0">
                          <p className="truncate font-semibold text-[var(--foreground)]">
                            {r.planLabel ? (
                              <span className="mr-1.5 rounded bg-[var(--accent)] px-1.5 py-0.5 text-xs text-white">
                                {r.planLabel}
                              </span>
                            ) : null}
                            {r.name}
                          </p>
                          <p className="truncate text-xs text-[var(--muted)]">
                            {r.exerciseCount} упр. · {r.muscleLabels.join(" · ")}
                          </p>
                        </div>
                        <div className="flex shrink-0 items-center gap-1.5">
                          {data?.weekday != null ? (
                            <button
                              type="button"
                              disabled={busy || removing}
                              className="rounded-[var(--radius-control)] px-2 py-2 text-sm font-semibold text-[var(--muted)] hover:bg-white hover:text-rose-700 disabled:opacity-40"
                              title="Убрать из плана на сегодня"
                              aria-label={`Убрать ${r.name} из плана на сегодня`}
                              onClick={() => void removeFromDay(r, data.weekday)}
                            >
                              {removing ? "…" : "×"}
                            </button>
                          ) : null}
                          <button
                            type="button"
                            disabled={busy || removing}
                            className="rounded-[var(--radius-control)] bg-[var(--accent)] px-4 py-2.5 text-sm font-bold text-white disabled:opacity-40"
                            onClick={() => onStartRoutine(r.id)}
                          >
                            Старт
                          </button>
                        </div>
                      </li>
                    );
                  })}
                </ul>
                <button
                  type="button"
                  disabled={busy}
                  className="mt-3 text-sm font-medium text-[var(--accent-ink)] disabled:opacity-40"
                  onClick={onStartBlank}
                >
                  Тренировка вне плана
                </button>
                {showRepeatInStart && lastRepeat && onRepeatLast ? (
                  <button
                    type="button"
                    disabled={busy}
                    className="mt-2 block text-sm font-medium text-[var(--muted-strong)] disabled:opacity-40"
                    onClick={() => onRepeatLast(lastRepeat.id)}
                  >
                    {busy ? "Копируем…" : lastRepeat.label}
                  </button>
                ) : null}
              </>
            ) : primary === "rest" ? (
              <>
                <p className="text-sm font-semibold text-[var(--foreground)]">День отдыха</p>
                <p className="mt-1 text-sm text-[var(--muted)]">
                  В плане пусто. «Вне плана» выше — если всё же хотите потренироваться.
                </p>
                {showRepeatInStart && lastRepeat && onRepeatLast ? (
                  <div className="mt-3">
                    <button
                      type="button"
                      disabled={busy}
                      className="w-full rounded-[var(--radius-control)] border border-[var(--line)] bg-white py-3 text-base font-semibold text-[var(--foreground)] disabled:opacity-40"
                      onClick={() => onRepeatLast(lastRepeat.id)}
                    >
                      {busy ? "Копируем…" : lastRepeat.label}
                    </button>
                    <p className="mt-1.5 text-center text-xs text-[var(--muted)]">
                      {lastRepeat.hint}
                    </p>
                  </div>
                ) : null}
                <button
                  type="button"
                  className="mt-3 text-sm font-semibold text-[var(--accent-ink)] underline-offset-2 hover:underline"
                  onClick={() =>
                    onCreatePlanDay ? onCreatePlanDay(data?.weekday) : onGoTemplates()
                  }
                >
                  Назначить план на сегодня
                </button>
              </>
            ) : (
              <>
                <p className="text-sm font-semibold text-[var(--foreground)]">Начать тренировку</p>
                <p className="mt-1 text-sm text-[var(--muted)]">
                  «Старт» / «Ещё» выше — пустая сессия, упражнения добавите сами.
                </p>
                {showRepeatInStart && lastRepeat && onRepeatLast ? (
                  <div className="mt-3">
                    <button
                      type="button"
                      disabled={busy}
                      className="w-full rounded-[var(--radius-control)] border border-[var(--border-quiet)] bg-[var(--accent-soft)]/80 py-3 text-base font-semibold text-[var(--accent-ink)] disabled:opacity-40"
                      onClick={() => onRepeatLast(lastRepeat.id)}
                    >
                      {busy ? "Копируем…" : lastRepeat.label}
                    </button>
                    <p className="mt-1.5 text-center text-xs text-[var(--muted)]">
                      {lastRepeat.hint}
                    </p>
                  </div>
                ) : null}
              </>
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
                  <div className="flex shrink-0 flex-col items-end gap-1">
                    <button
                      type="button"
                      className="text-sm font-semibold text-[var(--accent-ink)]"
                      onClick={() => onOpenSession(s.id, { summary: true })}
                    >
                      Итог
                    </button>
                    <button
                      type="button"
                      className="text-xs font-medium text-[var(--muted-strong)] underline-offset-2 hover:underline"
                      onClick={() => onOpenSession(s.id, { summary: false })}
                    >
                      Изменить
                    </button>
                  </div>
                </li>
              ))}
            </ul>
            {active || drafts.length > 0 ? null : (
              <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2">
                <button
                  type="button"
                  disabled={busy}
                  className="text-sm font-medium text-[var(--accent-ink)] disabled:opacity-40"
                  onClick={onStartBlank}
                >
                  + Ещё одна сегодня
                </button>
                {showRepeatInFinished && lastRepeat && onRepeatLast ? (
                  <button
                    type="button"
                    disabled={busy}
                    className="text-sm font-semibold text-[var(--accent-ink)] disabled:opacity-40"
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
                План = шаблоны с отмеченными днями. «×» убирает день (шаблон остаётся), название —
                редактирование.
              </p>
              {error ? <p className="text-sm text-red-600">{error}</p> : null}
              {loading || !data ? (
                <p className="text-sm text-[var(--muted)]">…</p>
              ) : (
                <ul className="space-y-2">
                  {data.week.map((day) => (
                    <li
                      key={day.weekday}
                      className={`flex items-center gap-3 rounded-[var(--radius-md)] px-2 py-2 text-sm ${
                        day.weekday === data.weekday ? "bg-[var(--accent-soft)]/70" : ""
                      }`}
                    >
                      <span
                        className={`w-8 shrink-0 font-semibold ${
                          day.weekday === data.weekday ? "text-[var(--accent-ink)]" : "text-[var(--muted)]"
                        }`}
                      >
                        {WEEKDAY_LABELS_RU[day.weekday]}
                      </span>
                      <div className="min-w-0 flex-1">
                        {day.routines.length === 0 ? (
                          onCreatePlanDay ? (
                            <button
                              type="button"
                              className="text-left font-medium text-[var(--muted)] underline-offset-2 hover:text-[var(--accent-ink)] hover:underline"
                              onClick={() => onCreatePlanDay(day.weekday)}
                            >
                              + Назначить
                            </button>
                          ) : (
                            <span className="text-[var(--muted)]">—</span>
                          )
                        ) : (
                          <ul className="space-y-1">
                            {day.routines.map((r) => {
                              const key = `${r.id}:${day.weekday}`;
                              const removing = removingKey === key;
                              return (
                                <li
                                  key={r.id}
                                  className="flex items-center justify-between gap-2"
                                >
                                  <button
                                    type="button"
                                    className="min-w-0 truncate text-left font-medium text-[var(--accent-ink)] underline-offset-2 hover:underline"
                                    onClick={() => onEditRoutine(r.id)}
                                  >
                                    {r.planLabel ? `${r.planLabel}: ` : ""}
                                    {r.name}
                                  </button>
                                  <button
                                    type="button"
                                    disabled={busy || removing}
                                    className="shrink-0 rounded px-2 py-0.5 text-sm font-semibold text-[var(--muted)] hover:bg-white hover:text-rose-700 disabled:opacity-40"
                                    title={`Убрать из плана на ${WEEKDAY_LABELS_RU[day.weekday]}`}
                                    aria-label={`Убрать ${r.name} из плана на ${WEEKDAY_LABELS_RU[day.weekday]}`}
                                    onClick={() => void removeFromDay(r, day.weekday)}
                                  >
                                    {removing ? "…" : "×"}
                                  </button>
                                </li>
                              );
                            })}
                          </ul>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
              {onCreatePlanDay ? (
                <button
                  type="button"
                  className="text-sm font-semibold text-[var(--accent-ink)] underline-offset-2 hover:underline"
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
