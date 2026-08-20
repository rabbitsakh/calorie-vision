"use client";

import { useCallback, useEffect, useState } from "react";
import { withBasePath } from "@/lib/paths";
import { hidePanelToday, isPanelHiddenToday, showPanelToday } from "@/lib/panel-visibility";

const PANEL_ID = "quick-add";

type QuickAddItem = {
  dishName: string;
  calories: number;
  protein: number | null;
  fat: number | null;
  carbs: number | null;
  portionGrams: number | null;
  mealType: string | null;
  count: number;
  why: string;
};

type QuickAddResponse = {
  suggestions: QuickAddItem[];
  mealTypeLabel: string;
};

type QuickAddMealsProps = {
  selectedDate: string;
  refreshKey: number;
  onSaved: () => void;
};

export function QuickAddMeals({ selectedDate, refreshKey, onSaved }: QuickAddMealsProps) {
  const [data, setData] = useState<QuickAddResponse | null>(null);
  const [adding, setAdding] = useState<string | null>(null);
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    setHidden(isPanelHiddenToday(PANEL_ID, selectedDate));
  }, [selectedDate]);

  const load = useCallback(async () => {
    try {
      const resp = await fetch(withBasePath("/api/meals/quick-add"));
      if (!resp.ok) return;
      setData((await resp.json()) as QuickAddResponse);
    } catch {
      // non-critical
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load, refreshKey]);

  async function addMeal(item: QuickAddItem) {
    setAdding(item.dishName);
    try {
      const resp = await fetch(withBasePath("/api/meals"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          date: selectedDate,
          dishName: item.dishName,
          calories: item.calories,
          protein: item.protein,
          fat: item.fat,
          carbs: item.carbs,
          portionGrams: item.portionGrams,
          mealType: item.mealType,
        }),
      });
      if (resp.ok) {
        onSaved();
      }
    } finally {
      setAdding(null);
    }
  }

  if (!data || data.suggestions.length === 0) return null;

  if (hidden) {
    return (
      <button
        type="button"
        className="flex w-full items-center justify-between gap-2 rounded-2xl border border-dashed border-teal-200 px-4 py-2.5 text-sm text-teal-600 hover:border-teal-300"
        onClick={() => {
          showPanelToday(PANEL_ID, selectedDate);
          setHidden(false);
        }}
      >
        <span>Быстрое добавление — {data.mealTypeLabel}</span>
        <span className="text-xs">Показать</span>
      </button>
    );
  }

  return (
    <div className="rounded-2xl border border-teal-100 bg-teal-50/50 p-4">
      <div className="mb-3 flex items-center justify-between gap-2">
        <div>
          <p className="font-semibold text-teal-900">Быстрое добавление</p>
          <p className="text-xs text-teal-700">Ваши частые блюда на {data.mealTypeLabel}</p>
        </div>
        <button
          type="button"
          className="btn-quiet text-xs text-teal-700 hover:bg-teal-100"
          onClick={() => {
            hidePanelToday(PANEL_ID, selectedDate);
            setHidden(true);
          }}
        >
          Скрыть
        </button>
      </div>
      <div className="flex flex-col gap-2">
        {data.suggestions.map((item) => (
          <button
            key={item.dishName}
            type="button"
            disabled={adding !== null}
            className="flex items-center justify-between gap-3 rounded-xl border border-teal-100 bg-white px-3 py-2.5 text-left transition-colors hover:border-teal-300 hover:bg-teal-50 disabled:opacity-60"
            onClick={() => void addMeal(item)}
          >
            <div className="min-w-0 flex-1">
              <p className="truncate font-medium text-slate-800">{item.dishName}</p>
              <p className="text-xs text-slate-500">{item.why}</p>
            </div>
            <div className="shrink-0 text-right">
              <p className="text-sm font-semibold text-teal-800">{item.calories} ккал</p>
              {adding === item.dishName ? (
                <span className="text-xs text-teal-600">Добавляем…</span>
              ) : (
                <span className="text-xs text-teal-600">+ Добавить</span>
              )}
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
