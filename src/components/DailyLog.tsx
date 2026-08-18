"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { DietTargets } from "@/components/DietTargets";
import type { DayMealsResponse, MealEntry } from "@/types";
import { formatDateTime, formatDateWords } from "@/lib/dates";
import { getImageUrl, withBasePath } from "@/lib/paths";
import { decodeHtmlEntities } from "@/lib/html-text";

type DailyLogProps = {
  selectedDate: string;
  refreshKey: number;
  onChanged?: () => void;
  compact?: boolean;
  timezone?: string | null;
};

export function DailyLog({ selectedDate, refreshKey, onChanged, compact, timezone }: DailyLogProps) {
  const [entries, setEntries] = useState<MealEntry[]>([]);
  const [totals, setTotals] = useState({ calories: 0, protein: 0, fat: 0, carbs: 0 });
  const [daySummary, setDaySummary] = useState<
    Pick<DayMealsResponse, "comparison" | "calorieTone" | "weightKg" | "dietLabel" | "sex">
  >({
    comparison: null,
    calorieTone: null,
    weightKg: null,
    dietLabel: null,
    sex: null,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const attemptedImageDates = useRef(new Set<string>());
  const selectedDateRef = useRef(selectedDate);
  selectedDateRef.current = selectedDate;

  const loadEntries = useCallback(async (quiet = false) => {
    const date = selectedDate;
    if (!quiet) {
      setLoading(true);
      setError(null);
    }

    try {
      const response = await fetch(withBasePath(`/api/meals?date=${date}`));
      const data = (await response.json()) as DayMealsResponse & { error?: string };

      if (!response.ok) {
        throw new Error(data.error ?? "Не удалось загрузить день");
      }

      if (selectedDateRef.current !== date) {
        return;
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
        sex: data.sex ?? null,
      });
    } catch (err) {
      if (!quiet) {
        setError(err instanceof Error ? err.message : "Ошибка загрузки");
      }
    } finally {
      if (!quiet) {
        setLoading(false);
      }
    }
  }, [selectedDate]);

  useEffect(() => {
    attemptedImageDates.current.delete(selectedDate);
    void loadEntries();
  }, [loadEntries, refreshKey, selectedDate]);

  useEffect(() => {
    if (loading || error) {
      return;
    }

    const missing = entries.some((entry) => !entry.imagePath);
    if (!missing || attemptedImageDates.current.has(selectedDate)) {
      return;
    }

    attemptedImageDates.current.add(selectedDate);
    const date = selectedDate;

    void (async () => {
      try {
        const response = await fetch(withBasePath("/api/meals/images"), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ date }),
        });
        const data = (await response.json()) as { updated?: number };
        if (response.ok && (data.updated ?? 0) > 0 && selectedDateRef.current === date) {
          await loadEntries(true);
        }
      } catch {
        // Diary still works if image lookup fails.
      }
    })();
  }, [loading, error, entries, selectedDate, loadEntries]);

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
            sex={daySummary.sex}
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
                    alt={decodeHtmlEntities(entry.dishName)}
                    className="h-full w-full object-cover"
                    loading="lazy"
                    decoding="async"
                  />
                </div>
              ) : null}

              <div className="flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="font-semibold">{decodeHtmlEntities(entry.dishName)}</h3>
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
                  {" · "}{formatDateTime(entry.createdAt, timezone)}
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
