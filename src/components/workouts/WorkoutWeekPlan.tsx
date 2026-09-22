"use client";

import { useCallback, useEffect, useState } from "react";
import { withBasePath } from "@/lib/paths";
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

type Props = {
  todayKey: string;
  sessions: TodaySessionCard[];
  onOpenSession: (id: string) => void;
  onStartBlank: () => void;
  onStartRoutine: (routineId: string) => void;
  onEditRoutine: (routineId: string) => void;
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
 * Today hub: one clear story — what's happening now, then how to start, then week plan.
 */
export function WorkoutWeekPlan({
  todayKey,
  sessions,
  onOpenSession,
  onStartBlank,
  onStartRoutine,
  onEditRoutine,
  onGoTemplates,
  busy,
}: Props) {
  const [data, setData] = useState<PlanResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [weekOpen, setWeekOpen] = useState(false);

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

  return (
    <div className="flex flex-col gap-4">
      <header>
        <h2 className="text-xl font-semibold text-slate-900">
          Сегодня
          {data ? (
            <span className="ml-2 text-base font-medium text-slate-500">
              · {data.weekdayLabel}
            </span>
          ) : null}
        </h2>
        <p className="mt-1 text-sm text-slate-500">
          Продолжите тренировку или начните новую.
        </p>
      </header>

      {active ? (
        <section className="rounded-2xl border-2 border-teal-400 bg-teal-50 p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-teal-800">
            Сейчас · {statusLabel(active.clockStatus)}
            {active.elapsedLabel ? ` · ${active.elapsedLabel}` : ""}
          </p>
          <p className="mt-1 text-lg font-semibold text-slate-900">
            {active.muscleLabels.join(" · ") || "Тренировка"}
          </p>
          <p className="text-sm text-slate-600">
            {active.exerciseCount} упр. · {sessionMetric(active)}
          </p>
          <button
            type="button"
            disabled={busy}
            className="mt-3 w-full rounded-xl bg-teal-700 py-3 text-base font-bold text-white disabled:opacity-40"
            onClick={() => onOpenSession(active.id)}
          >
            Продолжить
          </button>
        </section>
      ) : null}

      {!active && drafts.length > 0 ? (
        <section className="rounded-2xl border border-amber-200 bg-amber-50/60 p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-amber-900">
            Незавершённые сегодня
          </p>
          <ul className="mt-2 space-y-2">
            {drafts.map((s) => (
              <li key={s.id} className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate font-semibold text-slate-900">
                    {s.muscleLabels.join(" · ") || "Тренировка"}
                  </p>
                  <p className="text-xs text-slate-500">
                    {s.exerciseCount} упр. · {s.setCount} подх.
                  </p>
                </div>
                <button
                  type="button"
                  disabled={busy}
                  className="shrink-0 rounded-lg bg-teal-700 px-3 py-2 text-sm font-semibold text-white disabled:opacity-40"
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
        </section>
      ) : null}

      {!active && drafts.length === 0 ? (
        <section className="rounded-2xl border border-slate-200 bg-white p-4">
          <p className="text-sm font-semibold text-slate-900">Начать тренировку</p>
          <p className="mt-1 text-sm text-slate-500">
            Пустая сессия на сегодня — упражнения добавите сами.
          </p>
          <button
            type="button"
            disabled={busy}
            className="mt-3 w-full rounded-xl bg-[var(--accent)] py-3 text-base font-bold text-white disabled:opacity-40"
            onClick={onStartBlank}
          >
            Новая тренировка
          </button>

          {loading ? (
            <p className="mt-4 text-sm text-slate-400">Загрузка плана…</p>
          ) : error ? (
            <p className="mt-4 text-sm text-red-600">{error}</p>
          ) : planned.length > 0 ? (
            <div className="mt-4 border-t border-slate-100 pt-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Или по плану на сегодня
              </p>
              <ul className="mt-2 space-y-2">
                {planned.map((r) => (
                  <li
                    key={r.id}
                    className="flex items-center justify-between gap-2 rounded-xl bg-slate-50 px-3 py-2"
                  >
                    <div className="min-w-0">
                      <p className="truncate font-semibold text-slate-900">
                        {r.planLabel ? (
                          <span className="mr-1.5 rounded bg-teal-700 px-1.5 py-0.5 text-xs text-white">
                            {r.planLabel}
                          </span>
                        ) : null}
                        {r.name}
                      </p>
                      <p className="truncate text-xs text-slate-500">
                        {r.exerciseCount} упр. · {r.muscleLabels.join(" · ")}
                      </p>
                    </div>
                    <button
                      type="button"
                      disabled={busy}
                      className="shrink-0 rounded-lg bg-teal-700 px-3 py-2 text-sm font-semibold text-white disabled:opacity-40"
                      onClick={() => onStartRoutine(r.id)}
                    >
                      Старт
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <p className="mt-4 text-sm text-slate-500">
              Плана на сегодня нет.{" "}
              <button
                type="button"
                className="font-medium text-teal-800 underline-offset-2 hover:underline"
                onClick={onGoTemplates}
              >
                Назначить дни в шаблонах
              </button>
            </p>
          )}
        </section>
      ) : null}

      {finished.length > 0 ? (
        <section className="rounded-2xl border border-slate-200 bg-white p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Уже сегодня
          </p>
          <ul className="mt-2 space-y-2">
            {finished.map((s) => (
              <li key={s.id} className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate font-medium text-slate-900">
                    {s.muscleLabels.join(" · ") || "Тренировка"}
                  </p>
                  <p className="text-xs text-slate-500">{sessionMetric(s)}</p>
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
            <button
              type="button"
              disabled={busy}
              className="mt-3 text-sm font-medium text-teal-800 disabled:opacity-40"
              onClick={onStartBlank}
            >
              + Ещё одна сегодня
            </button>
          )}
        </section>
      ) : null}

      <section className="rounded-2xl border border-slate-200 bg-white p-4">
        <button
          type="button"
          className="flex w-full items-center justify-between text-left"
          onClick={() => setWeekOpen((v) => !v)}
        >
          <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            План на неделю
          </span>
          <span className="text-sm text-slate-400">{weekOpen ? "▾" : "▸"}</span>
        </button>
        {weekOpen ? (
          loading || !data ? (
            <p className="mt-2 text-sm text-slate-400">…</p>
          ) : (
            <ul className="mt-3 space-y-2">
              {data.week.map((day) => (
                <li key={day.weekday} className="flex gap-3 text-sm">
                  <span
                    className={`w-8 shrink-0 font-semibold ${
                      day.weekday === data.weekday ? "text-teal-800" : "text-slate-500"
                    }`}
                  >
                    {WEEKDAY_LABELS_RU[day.weekday]}
                  </span>
                  <div className="min-w-0 flex-1">
                    {day.routines.length === 0 ? (
                      <span className="text-slate-400">—</span>
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
          )
        ) : (
          <p className="mt-2 text-sm text-slate-500">
            {planned.length > 0
              ? `Сегодня: ${planned.map((r) => r.name).join(", ")}`
              : "Нажмите, чтобы посмотреть дни"}
          </p>
        )}
      </section>
    </div>
  );
}
