"use client";

import { useEffect, useState } from "react";
import { withBasePath } from "@/lib/paths";
import { hidePanelToday, isPanelHiddenToday, showPanelToday } from "@/lib/panel-visibility";

const PANEL_ID = "suggestions";

type Suggestion = {
  name: string;
  calories: number;
  protein: number;
  fat: number;
  carbs: number;
  portionGrams: number;
  why: string;
  category: "protein" | "carbs" | "fat" | "balanced" | "light";
};

type ApiResponse = {
  suggestions: Suggestion[];
  eaten?: { calories: number; protein: number; fat: number; carbs: number };
  target?: { calories: number; protein: number; fat: number; carbs: number };
  remaining?: { calories: number; protein: number; fat: number; carbs: number };
  pctCalories?: number;
  tip?: string;
  reason?: string;
  error?: string;
};

const CATEGORY_LABELS: Record<string, { label: string; color: string }> = {
  protein: { label: "Белковое", color: "bg-teal-100 text-teal-800" },
  carbs: { label: "Углеводы", color: "bg-violet-100 text-violet-800" },
  fat: { label: "Жиры", color: "bg-amber-100 text-amber-800" },
  balanced: { label: "Баланс", color: "bg-slate-100 text-slate-700" },
  light: { label: "Лёгкое", color: "bg-sky-100 text-sky-800" },
};

function MacroBar({
  label,
  eaten,
  target,
  color,
}: {
  label: string;
  eaten: number;
  target: number;
  color: string;
}) {
  const pct = target > 0 ? Math.min(100, Math.round((eaten / target) * 100)) : 0;
  const over = eaten > target;
  return (
    <div className="flex flex-col gap-0.5">
      <div className="flex justify-between text-[10px] font-medium text-slate-600">
        <span>{label}</span>
        <span className={over ? "text-rose-600" : ""}>{eaten}/{target} г</span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-slate-100">
        <div
          className={`h-1.5 rounded-full transition-all ${over ? "bg-rose-400" : color}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

export function MealSuggestions({
  selectedDate,
  totalCalories,
}: {
  selectedDate: string;
  totalCalories: number;
}) {
  const [data, setData] = useState<ApiResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [visible, setVisible] = useState(false);
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    setHidden(isPanelHiddenToday(PANEL_ID, selectedDate));
    setData(null);
    setVisible(false);
  }, [selectedDate]);

  async function load() {
    setLoading(true);
    try {
      const resp = await fetch(withBasePath(`/api/suggestions?date=${selectedDate}`));
      const json = (await resp.json()) as ApiResponse;
      setData(json);
    } finally {
      setLoading(false);
    }
  }

  if (hidden) {
    return (
      <button
        type="button"
        className="flex w-full items-center justify-between gap-2 rounded-2xl border border-dashed border-slate-200 px-4 py-2.5 text-sm text-slate-400 hover:border-slate-300"
        onClick={() => { showPanelToday(PANEL_ID, selectedDate); setHidden(false); }}
      >
        <span>🤖 Рекомендации AI</span>
        <span className="text-xs">Показать</span>
      </button>
    );
  }

  if (!visible) {
    return (
      <button
        type="button"
        className="flex w-full items-center gap-3 rounded-2xl border border-dashed border-teal-200 px-4 py-3.5 text-sm text-teal-700 hover:border-teal-400 hover:bg-teal-50"
        onClick={() => { setVisible(true); void load(); }}
      >
        <span className="text-xl">🤖</span>
        <div className="text-left">
          <p className="font-semibold">
            {totalCalories === 0 ? "Что съесть сегодня? Спросить AI" : "Что ещё съесть сегодня?"}
          </p>
          <p className="text-xs text-teal-600">
            {totalCalories === 0
              ? "AI подберёт блюда под вашу цель и норму калорий"
              : "AI проанализирует остаток макросов и предложит блюда"}
          </p>
        </div>
      </button>
    );
  }

  return (
    <section className="card overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between gap-2 px-4 py-3 md:px-6">
        <h2 className="text-base font-semibold">Рекомендации AI</h2>
        <div className="flex gap-2">
          <button
            type="button"
            className="text-xs text-slate-400 hover:text-slate-600"
            onClick={() => { setData(null); void load(); }}
            disabled={loading}
          >
            Обновить
          </button>
          <button
            type="button"
            className="text-xs text-slate-400 hover:text-slate-600"
            onClick={() => { hidePanelToday(PANEL_ID, selectedDate); setHidden(true); setVisible(false); }}
          >
            Скрыть
          </button>
        </div>
      </div>

      {/* Progress summary */}
      {data?.eaten && data.target ? (
        <div className="border-t border-slate-100 bg-slate-50/60 px-4 py-3 md:px-6">
          <div className="mb-2 flex items-baseline justify-between gap-2">
            <span className="text-sm font-medium text-slate-700">
              {data.eaten.calories} / {data.target.calories} ккал
            </span>
            <span className={`text-xs font-semibold ${(data.pctCalories ?? 0) > 100 ? "text-rose-600" : "text-teal-700"}`}>
              {data.pctCalories}%
            </span>
          </div>
          {/* Calorie bar */}
          <div className="mb-3 h-2 overflow-hidden rounded-full bg-slate-200">
            <div
              className={`h-2 rounded-full transition-all ${(data.pctCalories ?? 0) > 100 ? "bg-rose-400" : "bg-teal-500"}`}
              style={{ width: `${Math.min(100, data.pctCalories ?? 0)}%` }}
            />
          </div>
          <div className="grid grid-cols-3 gap-2">
            <MacroBar label="Белки" eaten={data.eaten.protein} target={data.target.protein} color="bg-teal-400" />
            <MacroBar label="Жиры" eaten={data.eaten.fat} target={data.target.fat} color="bg-amber-400" />
            <MacroBar label="Углеводы" eaten={data.eaten.carbs} target={data.target.carbs} color="bg-violet-400" />
          </div>
          {data.tip ? (
            <p className="mt-2 text-xs text-slate-500">{data.tip}</p>
          ) : null}
        </div>
      ) : null}

      {/* Loading */}
      {loading ? (
        <div className="flex items-center gap-2 px-4 py-4 text-sm text-slate-500 md:px-6">
          <span className="daisy-loading"><span /><span /><span /></span>
          Анализируем рацион и подбираем блюда...
        </div>
      ) : null}

      {/* Reason / empty state */}
      {data?.reason && !loading ? (
        <div className="px-4 py-4 md:px-6">
          <p className="text-sm text-slate-600">{data.reason}</p>
        </div>
      ) : null}

      {/* Remaining macros */}
      {data?.remaining && !data.reason && !loading ? (
        <div className="border-t border-slate-100 px-4 pt-3 text-xs text-slate-500 md:px-6">
          <span className="font-medium text-slate-600">Остаток: </span>
          {data.remaining.calories} ккал · Б {data.remaining.protein} г · Ж {data.remaining.fat} г · У {data.remaining.carbs} г
        </div>
      ) : null}

      {/* Suggestions */}
      {data?.suggestions && data.suggestions.length > 0 && !loading ? (
        <ul className="divide-y divide-slate-100 px-4 py-2 md:px-6">
          {data.suggestions.map((s, i) => {
            const cat = CATEGORY_LABELS[s.category] ?? CATEGORY_LABELS.balanced;
            return (
              <li key={i} className="py-3">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <p className="font-semibold text-slate-900">{s.name}</p>
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${cat.color}`}>
                        {cat.label}
                      </span>
                    </div>
                    {s.why ? <p className="mt-1 text-xs text-slate-500">{s.why}</p> : null}
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="text-sm font-bold text-teal-700">{s.calories} ккал</p>
                    {s.portionGrams ? <p className="text-xs text-slate-400">{s.portionGrams} г</p> : null}
                  </div>
                </div>
                {(s.protein || s.fat || s.carbs) ? (
                  <p className="mt-1 text-[10px] text-slate-400">
                    Б {s.protein} · Ж {s.fat} · У {s.carbs} г
                  </p>
                ) : null}
              </li>
            );
          })}
        </ul>
      ) : null}

      {/* Retry */}
      {data && !loading && data.suggestions.length === 0 && !data.reason ? (
        <div className="px-4 pb-4 md:px-6">
          <button type="button" className="btn btn-secondary text-sm" onClick={() => void load()}>
            Попробовать ещё раз
          </button>
        </div>
      ) : null}
    </section>
  );
}
