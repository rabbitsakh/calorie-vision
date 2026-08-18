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

function chartRange(values: number[], paddingRatio = 0.1): { min: number; max: number } {
  const filtered = values.filter((value) => value > 0);
  if (filtered.length === 0) {
    return { min: 0, max: 1 };
  }

  const rawMin = Math.min(...filtered);
  const rawMax = Math.max(...filtered);

  if (rawMin === rawMax) {
    const pad = Math.max(rawMin * 0.05, 1);
    return { min: Math.max(0, rawMin - pad), max: rawMax + pad };
  }

  const span = rawMax - rawMin;
  const pad = span * paddingRatio;
  return { min: Math.max(0, rawMin - pad), max: rawMax + pad };
}

function shouldShowDateLabel(index: number, total: number, period: "week" | "month"): boolean {
  if (period === "week") {
    return true;
  }

  if (index === 0 || index === total - 1) {
    return true;
  }

  return index % 7 === 0;
}

function BarChart({
  days,
  valueKey,
  color,
  unit,
  period,
}: {
  days: StatsDay[];
  valueKey: "calories" | "weightKg";
  color: string;
  unit: string;
  period: "week" | "month";
}) {
  const values = days.map((day) => {
    if (valueKey === "weightKg") {
      return day.weightKg ?? 0;
    }
    return day.calories;
  });

  const presentValues =
    valueKey === "weightKg"
      ? values.filter((value) => value > 0)
      : values.filter((value) => value > 0);

  const { min, max } = chartRange(presentValues);
  const span = Math.max(max - min, 1);

  return (
    <div>
      <div className="mb-2 flex justify-between text-xs text-slate-400">
        <span>
          {Math.round(max)} {unit}
        </span>
        <span>
          {Math.round(min)} {unit}
        </span>
      </div>

      <div className="flex h-44 items-end gap-0.5 sm:gap-1">
        {days.map((day, index) => {
          const value = valueKey === "weightKg" ? day.weightKg : day[valueKey];
          const height =
            value && value > 0 ? Math.max(((value - min) / span) * 100, 6) : 0;
          const showLabel = shouldShowDateLabel(index, days.length, period);

          return (
            <div key={day.date} className="flex min-w-0 flex-1 flex-col items-center gap-1">
              <div className="flex h-36 w-full items-end justify-center">
                {value && value > 0 ? (
                  <div
                    className={`w-full max-w-3 rounded-t-md sm:max-w-6 ${color}`}
                    style={{ height: `${height}%` }}
                    title={`${formatDateShort(day.date)}: ${value} ${unit}`}
                  />
                ) : (
                  <div className="h-0.5 w-full max-w-3 rounded bg-slate-100 sm:max-w-6" />
                )}
              </div>
              <span
                className={`truncate text-[10px] font-medium text-slate-500 ${showLabel ? "" : "invisible"}`}
                aria-hidden={!showLabel}
              >
                {formatDateShort(day.date)}
              </span>
            </div>
          );
        })}
      </div>
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
              {period === "week" ? "Последние 7 дней" : "Последние 30 дней · подписи раз в неделю"}
            </p>
            <div className="mt-4">
              <BarChart days={data.days} valueKey="calories" color="bg-teal-600" unit="ккал" period={period} />
            </div>
          </section>

          <section className="card p-4 md:p-6">
            <h2 className="text-lg font-bold">Вес по дням</h2>
            <p className="mt-1 text-sm text-slate-500">Шкала от минимума до максимума за период</p>
            <div className="mt-4">
              <BarChart days={data.days} valueKey="weightKg" color="bg-sky-600" unit="кг" period={period} />
            </div>
          </section>
        </>
      ) : null}
    </div>
  );
}
