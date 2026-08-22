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
  fiber: number | null;
  sugar: number | null;
  portionGrams: number | null;
  mealType: string | null;
  count: number;
  why: string;
};

type QuickAddResponse = {
  suggestions: QuickAddItem[];
  mealTypeLabel: string;
  yesterdayDate: string;
  yesterdayCount: number;
  today: string;
};

type QuickAddMealsProps = {
  selectedDate: string;
  refreshKey: number;
  onSaved: () => void;
  /** Inside QuickAddAgain — no outer chrome / hide chip. */
  embedded?: boolean;
};

export function QuickAddMeals({ selectedDate, refreshKey, onSaved, embedded = false }: QuickAddMealsProps) {
  const [data, setData] = useState<QuickAddResponse | null>(null);
  const [adding, setAdding] = useState<string | null>(null);
  const [copying, setCopying] = useState(false);
  const [copyError, setCopyError] = useState<string | null>(null);
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
          fiber: item.fiber,
          sugar: item.sugar,
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

  async function copyYesterday() {
    if (!data?.yesterdayDate) return;
    setCopying(true);
    setCopyError(null);
    try {
      const resp = await fetch(withBasePath("/api/meals/copy"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fromDate: data.yesterdayDate, toDate: selectedDate }),
      });
      const payload = (await resp.json()) as { error?: string };
      if (resp.ok) {
        onSaved();
      } else {
        setCopyError(payload.error ?? "Не удалось скопировать");
      }
    } finally {
      setCopying(false);
    }
  }

  if (!data) return null;

  const showCopy = data.yesterdayCount > 0;
  const showSuggestions = data.suggestions.length > 0;
  if (!showCopy && !showSuggestions) return null;

  if (hidden && !embedded) {
    return (
      <button
        type="button"
        className="flex w-full items-center justify-between gap-2 rounded-2xl border border-dashed border-teal-200 px-4 py-2.5 text-sm text-teal-600 hover:border-teal-300"
        onClick={() => {
          showPanelToday(PANEL_ID, selectedDate);
          setHidden(false);
        }}
      >
        <span>Быстрое добавление{showSuggestions ? ` — ${data.mealTypeLabel}` : ""}</span>
        <span className="text-xs">Показать</span>
      </button>
    );
  }

  return (
    <div className={embedded ? "" : "rounded-2xl border border-teal-100 bg-teal-50/50 p-4"}>
      {!embedded ? (
      <div className="mb-3 flex items-center justify-between gap-2">
        <div>
          <p className="font-semibold text-teal-900">Быстрое добавление</p>
          <p className="text-xs text-teal-700">
            {showSuggestions
              ? `Ваши частые блюда на ${data.mealTypeLabel}`
              : "Повторите вчерашний рацион одним нажатием"}
          </p>
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
      ) : (
        <p className="mb-3 text-xs text-slate-500">
          {showSuggestions
            ? `Частые блюда на ${data.mealTypeLabel}`
            : "Повторите вчерашний рацион"}
        </p>
      )}

      {showCopy ? (
        <button
          type="button"
          disabled={copying || adding !== null}
          className="mb-2 flex w-full items-center justify-between gap-3 rounded-xl border border-teal-200 bg-white px-3 py-2.5 text-left transition-colors hover:border-teal-400 hover:bg-teal-50 disabled:opacity-60"
          onClick={() => void copyYesterday()}
        >
          <div className="min-w-0 flex-1">
            <p className="font-medium text-slate-800">Как вчера</p>
            <p className="text-xs text-slate-500">
              Скопировать все записи ({data.yesterdayCount})
            </p>
          </div>
          <span className="shrink-0 text-sm font-semibold text-teal-800">
            {copying ? "Копируем…" : "Повторить"}
          </span>
        </button>
      ) : null}

      {copyError ? <p className="mb-2 text-xs text-red-600">{copyError}</p> : null}

      {showSuggestions ? (
        <div className="flex flex-col gap-2">
          {data.suggestions.map((item) => (
            <button
              key={item.dishName}
              type="button"
              disabled={adding !== null || copying}
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
      ) : null}
    </div>
  );
}
