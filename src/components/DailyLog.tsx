"use client";

import { useCallback, useEffect, useState } from "react";
import { DietTargets } from "@/components/DietTargets";
import type { DayMealsResponse, MealEntry } from "@/types";
import { formatDateWords } from "@/lib/dates";
import { getImageUrl, withBasePath } from "@/lib/paths";

type DailyLogProps = {
  selectedDate: string;
  refreshKey: number;
  onChanged?: () => void;
  compact?: boolean;
};

export function DailyLog({ selectedDate, refreshKey, onChanged, compact }: DailyLogProps) {
  const [entries, setEntries] = useState<MealEntry[]>([]);
  const [totals, setTotals] = useState({ calories: 0, protein: 0, fat: 0, carbs: 0 });
  const [daySummary, setDaySummary] = useState<
    Pick<DayMealsResponse, "comparison" | "calorieTone" | "weightKg" | "dietLabel">
  >({
    comparison: null,
    calorieTone: null,
    weightKg: null,
    dietLabel: null,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadEntries = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(withBasePath(`/api/meals?date=${selectedDate}`));
      const data = (await response.json()) as DayMealsResponse & { error?: string };

      if (!response.ok) {
        throw new Error(data.error ?? "Не удалось загрузить день");
      }

      setEntries(data.entries);
      setTotals({
        calories: data.totalCalories,
        protein: data.totalProtein ?? 0,
        fat: data.totalFat ?? 0,
        carbs: data.totalCarbs ?? 0,
      });
      setDaySummary({
        comparison: data.comparison ?? null,
        calorieTone: data.calorieTone ?? null,
        weightKg: data.weightKg ?? null,
        dietLabel: data.dietLabel ?? null,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ошибка загрузки");
    } finally {
      setLoading(false);
    }
  }, [selectedDate]);

  useEffect(() => {
    loadEntries();
  }, [loadEntries, refreshKey]);

  async function handleDelete(id: string) {
    const response = await fetch(withBasePath(`/api/meals/${id}`), { method: "DELETE" });
    if (response.ok) {
      await loadEntries();
      onChanged?.();
    }
  }

  const displayDate = formatDateWords(selectedDate);

  return (
    <section className="card p-6">
      <div className="flex flex-col gap-5">
        <div className="flex flex-wrap items-end justify-between gap-3">
          {!compact ? (
            <div>
              <h2 className="text-xl font-bold">Дневник за день</h2>
              <p className="mt-1 text-sm text-slate-500">{displayDate}</p>
            </div>
          ) : (
            <h2 className="text-lg font-bold">Дневник за день</h2>
          )}
          <div className="rounded-2xl bg-teal-700 px-4 py-3 text-white">
            <div className="text-xs uppercase tracking-wide text-teal-100">Итого</div>
            <div className="text-2xl font-bold">{totals.calories} ккал</div>
            <div className="text-xs text-teal-100">
              Б {totals.protein} · Ж {totals.fat} · У {totals.carbs}
            </div>
          </div>
        </div>

        {daySummary.comparison && daySummary.calorieTone && daySummary.weightKg != null ? (
          <DietTargets
            comparison={daySummary.comparison}
            calorieTone={daySummary.calorieTone}
            weightKg={daySummary.weightKg}
            dietLabel={daySummary.dietLabel}
          />
        ) : (
          <p className="rounded-2xl bg-slate-50 px-4 py-3 text-sm text-slate-500">
            Чтобы увидеть рекомендуемый рацион и дефицит/профицит, укажите вес и выберите цель.
          </p>
        )}

        {loading ? <p className="text-sm text-slate-500">Загрузка...</p> : null}
        {error ? <p className="text-sm text-red-600">{error}</p> : null}

        {!loading && !error && entries.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-200 px-4 py-10 text-center text-slate-500">
            За этот день пока нет записей. Добавьте еду выше.
          </div>
        ) : null}

        <div className="flex flex-col gap-3">
          {entries.map((entry) => (
            <article
              key={entry.id}
              className="flex flex-col gap-4 rounded-2xl border border-slate-100 bg-slate-50 p-4 md:flex-row md:items-center"
            >
              {entry.imagePath ? (
                <div className="h-24 w-full shrink-0 overflow-hidden rounded-xl bg-white md:w-28">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={getImageUrl(entry.imagePath)}
                    alt={entry.dishName}
                    className="h-full w-full object-cover"
                    referrerPolicy="no-referrer-when-downgrade"
                  />
                </div>
              ) : null}

              <div className="flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="font-semibold">{entry.dishName}</h3>
                  {entry.wasCorrected ? (
                    <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800">
                      исправлено
                    </span>
                  ) : null}
                </div>
                <p className="mt-1 text-sm text-slate-500">
                  {entry.calories} ккал
                  {entry.portionGrams ? ` · ${entry.portionGrams} г` : ""}
                  {entry.protein ? ` · Б ${entry.protein}` : ""}
                  {entry.fat ? ` · Ж ${entry.fat}` : ""}
                  {entry.carbs ? ` · У ${entry.carbs}` : ""}
                </p>
              </div>

              <button
                type="button"
                className="btn btn-danger self-start md:self-center"
                onClick={() => handleDelete(entry.id)}
              >
                Удалить
              </button>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
