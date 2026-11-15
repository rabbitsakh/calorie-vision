"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useOptionalRationDay } from "@/components/RationDayProvider";
import { isLikelyOfflineError, shouldQueueMealSave } from "@/lib/connectivity";
import {
  buildEveningDaySummary,
  shouldShowEveningDaySummary,
  type EveningFoodInput,
  type EveningSummary,
  type EveningSuggestion,
} from "@/lib/evening-day-summary";
import { enqueueFailedSave } from "@/lib/meal-draft-queue";
import { hourInTimezone } from "@/lib/meal-type";
import { trackFirstMealSaveGoal, trackMealSavedGoal } from "@/lib/metrika-funnel";
import { hidePanelToday, isPanelHiddenToday, showPanelToday } from "@/lib/panel-visibility";
import { withBasePath } from "@/lib/paths";
import { buildQuickMealLogExtras } from "@/lib/quick-meal-log";
import type { SaveMealInput } from "@/lib/save-meal";

const PANEL_ID = "evening-summary";

type QuickAddFood = {
  dishName?: string;
  calories?: number;
  protein?: number | null;
  fat?: number | null;
  carbs?: number | null;
  portionGrams?: number | null;
  count?: number;
};

type FavoriteFood = {
  id?: string;
  name?: string;
  calories?: number;
  protein?: number | null;
  fat?: number | null;
  carbs?: number | null;
  portionGrams?: number | null;
  useCount?: number;
};

function fromQuickAdd(item: QuickAddFood): EveningFoodInput | null {
  if (!item.dishName?.trim() || !Number.isFinite(item.calories) || (item.calories ?? 0) <= 0) {
    return null;
  }
  return {
    name: item.dishName,
    calories: item.calories ?? 0,
    protein: item.protein,
    fat: item.fat,
    carbs: item.carbs,
    portionGrams: item.portionGrams,
    useCount: item.count ?? 1,
  };
}

function fromFavorite(item: FavoriteFood): EveningFoodInput | null {
  if (!item.name?.trim() || !Number.isFinite(item.calories) || (item.calories ?? 0) <= 0) {
    return null;
  }
  return {
    name: item.name,
    calories: item.calories ?? 0,
    protein: item.protein,
    fat: item.fat,
    carbs: item.carbs,
    portionGrams: item.portionGrams,
    customFoodId: item.id ?? null,
    useCount: item.useCount ?? 1,
  };
}

export function EveningDaySummaryView({
  summary,
  busyKey,
  notice,
  onAdd,
  onHide,
}: {
  summary: EveningSummary;
  busyKey: string | null;
  notice: string | null;
  onAdd: (item: EveningSuggestion) => void;
  onHide?: () => void;
}) {
  const calories = summary.stats.find((stat) => stat.key === "calories");
  const water = summary.stats.find((stat) => stat.key === "water");
  const macros = summary.stats.filter((stat) => stat.key !== "calories" && stat.key !== "water");

  return (
    <section
      id="evening-day-summary"
      data-evening-summary=""
      className="mt-3 scroll-mt-4 max-w-full overflow-hidden rounded-[var(--radius-lg)] border border-[var(--border-quiet)] bg-[var(--accent-summary-soft)]/55 px-3 py-3"
      aria-label="Итог дня"
    >
      <div className="mb-2 flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h2 className="font-display text-base font-semibold tracking-tight text-[var(--accent-ink)]">
            Итог дня
          </h2>
          <p className="mt-0.5 text-[11px] leading-snug text-[var(--muted)]">С 18:00 · без оценок</p>
        </div>
        {onHide ? (
          <button type="button" className="btn-quiet shrink-0 text-[var(--muted)]" onClick={onHide}>
            Скрыть
          </button>
        ) : null}
      </div>

      <p className="min-w-0 text-sm font-semibold tabular-nums text-[var(--foreground)]">
        <span className="font-medium text-[var(--muted)]">Ккал </span>
        {calories?.text}
      </p>
      <div className="mt-2 grid grid-cols-3 gap-1.5">
        {macros.map((stat) => (
          <div
            key={stat.key}
            className="min-w-0 rounded-[var(--radius-sm)] bg-[var(--card)]/75 px-2 py-1.5"
          >
            <p className="text-[10px] font-semibold uppercase tracking-wide text-[var(--muted)]">
              <span className="sr-only">{stat.label}</span>
              <span aria-hidden>{stat.short}</span>
            </p>
            <p className="truncate text-[13px] font-semibold tabular-nums leading-tight text-[var(--foreground)]">
              {stat.text}
            </p>
          </div>
        ))}
      </div>
      {water ? (
        <p className="mt-2 min-w-0 text-sm text-[var(--muted-strong)]">
          <span className="font-semibold text-[var(--foreground)]">Вода </span>
          <span className="tabular-nums">{water.text}</span>
        </p>
      ) : null}

      <ul className="mt-2 space-y-1">
        {summary.phrases.map((phrase) => (
          <li key={phrase} className="break-words text-sm leading-snug text-[var(--muted-strong)]">
            {phrase}
          </li>
        ))}
      </ul>

      {summary.suggestions.length > 0 ? (
        <div className="mt-2.5">
          <p className="mb-1.5 text-[11px] font-semibold text-[var(--muted)]">Можно добрать</p>
          <div className="flex flex-col gap-1.5">
            {summary.suggestions.map((item) => (
              <button
                key={item.key}
                type="button"
                className="flex min-h-10 w-full min-w-0 items-center justify-between gap-2 rounded-[var(--radius-md)] border border-[var(--border-quiet)] bg-[var(--card)] px-2.5 py-2 text-left text-[0.9375rem]"
                disabled={busyKey !== null}
                aria-label={`${item.label}, ${item.calories} ккал`}
                onClick={() => onAdd(item)}
              >
                <span className="min-w-0 truncate font-semibold text-[var(--foreground)]">
                  {busyKey === item.key ? "Добавляем…" : item.label}
                </span>
                <span className="shrink-0 tabular-nums text-[var(--muted)]">{item.calories}</span>
              </button>
            ))}
          </div>
        </div>
      ) : null}
      {notice ? <p className="mt-2 break-words text-xs text-[var(--muted-strong)]">{notice}</p> : null}
    </section>
  );
}

type EveningDaySummaryCardProps = {
  today: string;
  selectedDate: string;
  timezone?: string | null;
  onSaved: () => void;
};

export function EveningDaySummaryCard({
  today,
  selectedDate,
  timezone,
  onSaved,
}: EveningDaySummaryCardProps) {
  const day = useOptionalRationDay();
  const [hour, setHour] = useState<number | null>(null);
  const [hidden, setHidden] = useState<boolean | null>(null);
  const [extraHistory, setExtraHistory] = useState<EveningFoodInput[]>([]);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    const tick = () => setHour(hourInTimezone(new Date(), timezone));
    tick();
    const id = window.setInterval(tick, 60_000);
    return () => window.clearInterval(id);
  }, [timezone]);

  useEffect(() => {
    setHidden(isPanelHiddenToday(PANEL_ID, selectedDate));
  }, [selectedDate]);

  const entryCount = day?.data?.meals.entries?.length ?? 0;
  const inWindow =
    hour != null &&
    shouldShowEveningDaySummary({
      isToday: selectedDate === today,
      hour,
      entryCount,
    });
  const visible = hidden === false && inWindow;

  const loadHistory = useCallback(async () => {
    try {
      const [qaResp, favResp] = await Promise.all([
        fetch(withBasePath("/api/meals/quick-add")),
        fetch(withBasePath("/api/custom-foods")),
      ]);
      const next: EveningFoodInput[] = [];
      if (qaResp.ok) {
        const qa = (await qaResp.json()) as { suggestions?: QuickAddFood[] };
        for (const item of qa.suggestions ?? []) {
          const food = fromQuickAdd(item);
          if (food) next.push(food);
        }
      }
      if (favResp.ok) {
        const fav = (await favResp.json()) as { foods?: FavoriteFood[] };
        for (const item of fav.foods ?? []) {
          const food = fromFavorite(item);
          if (food) next.push(food);
        }
      }
      setExtraHistory(next);
    } catch {
      // Остаются записи сегодняшнего дня и справочник.
    }
  }, []);

  useEffect(() => {
    if (!visible) return;
    void loadHistory();
  }, [visible, loadHistory, day?.refreshKey]);

  const summary = useMemo(() => {
    const meals = day?.data?.meals;
    if (!meals) return null;
    const todayFoods: EveningFoodInput[] = (meals.entries ?? []).map((entry) => ({
      name: entry.dishName,
      calories: entry.calories,
      protein: entry.protein,
      fat: entry.fat,
      carbs: entry.carbs,
      portionGrams: entry.portionGrams,
      useCount: 1,
    }));
    return buildEveningDaySummary({
      totals: {
        calories: meals.totalCalories ?? 0,
        protein: meals.totalProtein ?? 0,
        fat: meals.totalFat ?? 0,
        carbs: meals.totalCarbs ?? 0,
        waterMl: day?.data?.water.totalMl ?? 0,
      },
      targets: {
        calories: meals.target?.calories ?? null,
        protein: meals.target?.protein ?? null,
        fat: meals.target?.fat ?? null,
        carbs: meals.target?.carbs ?? null,
        waterMl: day?.data?.water.target ?? null,
      },
      history: [...todayFoods, ...extraHistory],
    });
  }, [day?.data, extraHistory]);

  async function addSuggestion(item: EveningSuggestion) {
    setBusyKey(item.key);
    setNotice(null);
    const { mealType, eatenAt } = buildQuickMealLogExtras(selectedDate, timezone);
    const body: SaveMealInput = {
      date: selectedDate,
      dishName: item.dishName,
      calories: item.calories,
      protein: item.protein,
      fat: item.fat,
      carbs: item.carbs,
      portionGrams: item.portionGrams ?? undefined,
      mealType,
      eatenAt,
    };
    try {
      const resp = await fetch(withBasePath("/api/meals"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (resp.ok) {
        if (item.customFoodId) {
          void fetch(withBasePath(`/api/custom-foods/${item.customFoodId}/use`), { method: "POST" });
        }
        trackFirstMealSaveGoal();
        trackMealSavedGoal();
        onSaved();
        return;
      }
      if (shouldQueueMealSave(resp.status, null)) {
        enqueueFailedSave(selectedDate, body);
        setNotice("Не записалось — в очереди");
        onSaved();
      } else {
        setNotice("Не удалось добавить");
      }
    } catch (err) {
      if (shouldQueueMealSave(null, err) || isLikelyOfflineError(err)) {
        enqueueFailedSave(selectedDate, body);
        setNotice("В очереди на устройстве");
        onSaved();
      } else {
        setNotice("Не удалось добавить");
      }
    } finally {
      setBusyKey(null);
    }
  }

  if (hidden === true && inWindow) {
    return (
      <button
        type="button"
        className="mt-3 flex w-full min-w-0 items-center justify-between gap-2 rounded-2xl border border-dashed border-[var(--border-quiet)] bg-[var(--accent-summary-soft)]/40 px-3 py-2.5 text-left text-sm text-[var(--muted-strong)]"
        onClick={() => {
          showPanelToday(PANEL_ID, selectedDate);
          setHidden(false);
        }}
      >
        <span className="min-w-0 truncate">Итог дня</span>
        <span className="shrink-0 text-xs">Показать</span>
      </button>
    );
  }

  if (!visible || !summary) return null;

  return (
    <EveningDaySummaryView
      summary={summary}
      busyKey={busyKey}
      notice={notice}
      onAdd={(item) => void addSuggestion(item)}
      onHide={() => {
        hidePanelToday(PANEL_ID, selectedDate);
        setHidden(true);
      }}
    />
  );
}
