"use client";

import { useCallback, useEffect, useState } from "react";
import { withBasePath } from "@/lib/paths";
import { WEEKDAY_LABELS_RU } from "@/lib/workouts/weekdays";
import type { SerializedRoutine } from "@/lib/workouts/routines";

type PlanResponse = {
  date: string;
  weekday: number;
  weekdayLabel: string;
  today: SerializedRoutine[];
  week: Array<{ weekday: number; label: string; routines: SerializedRoutine[] }>;
};

type Props = {
  todayKey: string;
  onStart: (routineId: string) => void;
  onEdit: (routineId: string) => void;
  busy?: boolean;
};

export function WorkoutWeekPlan({ todayKey, onStart, onEdit, busy }: Props) {
  const [data, setData] = useState<PlanResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

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

  if (loading) {
    return <p className="text-sm text-slate-500">План…</p>;
  }
  if (error) {
    return <p className="text-sm text-red-600">{error}</p>;
  }
  if (!data) return null;

  return (
    <div className="flex flex-col gap-4">
      <section className="rounded-2xl border-2 border-teal-300 bg-white p-4 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-wide text-teal-800">
          Сегодня · {data.weekdayLabel}
        </p>
        {data.today.length === 0 ? (
          <p className="mt-2 text-sm text-slate-600">
            На сегодня ничего не назначено. Откройте шаблон → дни недели.
          </p>
        ) : (
          <ul className="mt-3 space-y-2">
            {data.today.map((r) => (
              <li
                key={r.id}
                className="flex items-center justify-between gap-2 rounded-xl bg-teal-50 px-3 py-2"
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
                  className="shrink-0 rounded-lg bg-[var(--accent)] px-3 py-2 text-sm font-semibold text-white disabled:opacity-40"
                  onClick={() => onStart(r.id)}
                >
                  Старт
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Неделя</p>
        <ul className="mt-2 space-y-2">
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
                      onClick={() => onEdit(r.id)}
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
      </section>
    </div>
  );
}
