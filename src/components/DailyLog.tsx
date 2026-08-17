"use client";

import { useCallback, useEffect, useState } from "react";
import type { DayMealsResponse, MealEntry } from "@/types";
import { formatDisplayDate } from "@/lib/dates";
import { withBasePath } from "@/lib/paths";

type DailyLogProps = {
  selectedDate: string;
  refreshKey: number;
};

export function DailyLog({ selectedDate, refreshKey }: DailyLogProps) {
  const [entries, setEntries] = useState<MealEntry[]>([]);
  const [totalCalories, setTotalCalories] = useState(0);
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
      setTotalCalories(data.totalCalories);
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
    }
  }

  const displayDate = formatDisplayDate(new Date(`${selectedDate}T00:00:00`));

  return (
    <section className="card p-6">
      <div className="flex flex-col gap-5">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-xl font-bold">Дневник за день</h2>
            <p className="mt-1 text-sm capitalize text-slate-500">{displayDate}</p>
          </div>
          <div className="rounded-2xl bg-teal-700 px-4 py-3 text-white">
            <div className="text-xs uppercase tracking-wide text-teal-100">Итого</div>
            <div className="text-2xl font-bold">{totalCalories} ккал</div>
          </div>
        </div>

        {loading ? <p className="text-sm text-slate-500">Загрузка...</p> : null}
        {error ? <p className="text-sm text-red-600">{error}</p> : null}

        {!loading && !error && entries.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-200 px-4 py-10 text-center text-slate-500">
            За этот день пока нет записей. Загрузите фото еды, чтобы начать.
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
                    src={withBasePath(entry.imagePath)}
                    alt={entry.dishName}
                    className="h-full w-full object-cover"
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
