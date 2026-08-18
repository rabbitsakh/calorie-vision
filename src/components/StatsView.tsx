"use client";

import { useCallback, useEffect, useState } from "react";
import { formatDateShort } from "@/lib/dates";
import { withBasePath } from "@/lib/paths";

type StatsDay = {
  date: string;
  calories: number;
  protein: number;
  fat: number;
  carbs: number;
  weightKg: number | null;
};

type StatsResponse = {
  period: "week" | "month";
  days: StatsDay[];
  summary: {
    avgCalories: number;
    totalMealDays: number;
    weightChangeKg: number | null;
    firstWeightKg: number | null;
    lastWeightKg: number | null;
    daysWithWeight: number;
  };
  error?: string;
};

type StatsViewProps = {
  endDate: string;
};

function BarChart({
  days,
  valueKey,
  color,
  unit,
}: {
  days: StatsDay[];
  valueKey: "calories" | "weightKg";
  color: string;
  unit: string;
}) {
  const values = days.map((day) => (valueKey === "weightKg" ? day.weightKg ?? 0 : day[valueKey]));
  const max = Math.max(...values, 1);

  return (
    <div className="flex h-44 items-end gap-1 sm:gap-2">
      {days.map((day) => {
        const value = valueKey === "weightKg" ? day.weightKg : day[valueKey];
        const height = value ? Math.max((value / max) * 100, 4) : 0;

        return (
          <div key={day.date} className="flex min-w-0 flex-1 flex-col items-center gap-1">
            <div className="flex h-36 w-full items-end justify-center">
              {value ? (
                <div
                  className={`w-full max-w-8 rounded-t-lg ${color}`}
                  style={{ height: `${height}%` }}
                  title={`${formatDateShort(day.date)}: ${value} ${unit}`}
                />
              ) : (
                <div className="h-1 w-full max-w-8 rounded bg-slate-100" />
              )}
            </div>
            <span className="truncate text-[10px] font-medium text-slate-500 sm:text-xs">
              {formatDateShort(day.date)}
            </span>
          </div>
        );
      })}
    </div>
  );
}

export function StatsView({ endDate }: StatsViewProps) {
  const [period, setPeriod] = useState<"week" | "month">("week");
  const [data, setData] = useState<StatsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadStats = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(withBasePath(`/api/stats?period=${period}&end=${endDate}`));
      const payload = (await response.json()) as StatsResponse;
      if (!response.ok) {
        throw new Error(payload.error ?? "Не удалось загрузить статистику");
      }
      setData(payload);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ошибка загрузки");
    } finally {
      setLoading(false);
    }
  }, [endDate, period]);

  useEffect(() => {
    void loadStats();
  }, [loadStats]);

  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-2 gap-2 rounded-xl bg-slate-100 p-1 sm:max-w-xs">
        <button
          type="button"
          className={`rounded-lg px-3 py-2 text-sm font-semibold ${period === "week" ? "bg-white text-teal-800 shadow" : "text-slate-600"}`}
          onClick={() => setPeriod("week")}
        >
          Неделя
        </button>
        <button
          type="button"
          className={`rounded-lg px-3 py-2 text-sm font-semibold ${period === "month" ? "bg-white text-teal-800 shadow" : "text-slate-600"}`}
          onClick={() => setPeriod("month")}
        >
          Месяц
        </button>
      </div>

      {loading ? <p className="text-sm text-slate-500">Загрузка...</p> : null}
      {error ? <p className="text-sm text-red-600">{error}</p> : null}

      {data ? (
        <>
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-2xl bg-slate-50 px-4 py-3">
              <div className="text-xs uppercase tracking-wide text-slate-500">Среднее ккал/день</div>
              <div className="mt-1 text-2xl font-bold">{data.summary.avgCalories}</div>
            </div>
            <div className="rounded-2xl bg-slate-50 px-4 py-3">
              <div className="text-xs uppercase tracking-wide text-slate-500">Дней с едой</div>
              <div className="mt-1 text-2xl font-bold">{data.summary.totalMealDays}</div>
            </div>
            <div className="rounded-2xl bg-slate-50 px-4 py-3">
              <div className="text-xs uppercase tracking-wide text-slate-500">Изменение веса</div>
              <div className="mt-1 text-2xl font-bold">
                {data.summary.weightChangeKg != null
                  ? `${data.summary.weightChangeKg > 0 ? "+" : ""}${data.summary.weightChangeKg} кг`
                  : "—"}
              </div>
            </div>
          </div>

          <section className="card p-4 md:p-6">
            <h2 className="text-lg font-bold">Калории по дням</h2>
            <p className="mt-1 text-sm text-slate-500">
              {period === "week" ? "Последние 7 дней" : "Последние 30 дней"}
            </p>
            <div className="mt-4">
              <BarChart days={data.days} valueKey="calories" color="bg-teal-600" unit="ккал" />
            </div>
          </section>

          <section className="card p-4 md:p-6">
            <h2 className="text-lg font-bold">Вес по дням</h2>
            <p className="mt-1 text-sm text-slate-500">Только дни с записью веса</p>
            <div className="mt-4">
              <BarChart days={data.days} valueKey="weightKg" color="bg-sky-600" unit="кг" />
            </div>
          </section>
        </>
      ) : null}
    </div>
  );
}
