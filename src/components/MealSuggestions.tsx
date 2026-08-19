"use client";

import { useEffect, useState } from "react";
import { withBasePath } from "@/lib/paths";

type Suggestion = { name: string; calories: number; why: string };

type Response = {
  suggestions: Suggestion[];
  reason?: string;
  remaining?: { calories: number; protein: number; fat: number; carbs: number };
  error?: string;
};

export function MealSuggestions({ selectedDate, totalCalories }: { selectedDate: string; totalCalories: number }) {
  const [data, setData] = useState<Response | null>(null);
  const [loading, setLoading] = useState(false);
  const [visible, setVisible] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const resp = await fetch(withBasePath(`/api/suggestions?date=${selectedDate}`));
      const json = (await resp.json()) as Response;
      setData(json);
    } finally {
      setLoading(false);
    }
  }

  // Only show the button when there are some calories logged
  if (totalCalories === 0) return null;

  if (!visible) {
    return (
      <button
        type="button"
        className="flex w-full items-center gap-2 rounded-2xl border border-dashed border-teal-200 px-4 py-3 text-sm text-teal-700 hover:border-teal-300 hover:bg-teal-50"
        onClick={() => { setVisible(true); void load(); }}
      >
        <span className="text-lg">🤖</span>
        Что ещё съесть сегодня? Спросить AI
      </button>
    );
  }

  return (
    <section className="card p-4 md:p-6">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-base font-semibold">Рекомендации AI</h2>
        <button type="button" className="text-xs text-slate-400" onClick={() => setVisible(false)}>Скрыть</button>
      </div>

      {loading ? (
        <div className="mt-3 flex items-center gap-2 text-sm text-slate-500">
          <span className="daisy-loading"><span /><span /><span /></span> Думаем...
        </div>
      ) : null}

      {data?.reason && !loading ? (
        <p className="mt-3 text-sm text-slate-600">{data.reason}</p>
      ) : null}

      {data?.remaining && !loading ? (
        <p className="mt-2 text-xs text-slate-500">
          Осталось: {data.remaining.calories} ккал · Б {Math.round(data.remaining.protein)} г · Ж {Math.round(data.remaining.fat)} г · У {Math.round(data.remaining.carbs)} г
        </p>
      ) : null}

      {data?.suggestions && data.suggestions.length > 0 && !loading ? (
        <ul className="mt-3 flex flex-col gap-2">
          {data.suggestions.map((s, i) => (
            <li key={i} className="rounded-2xl border border-teal-100 bg-teal-50/50 px-4 py-3">
              <div className="flex items-baseline justify-between gap-2">
                <p className="font-medium text-teal-900">{s.name}</p>
                <span className="shrink-0 text-sm font-semibold text-teal-700">~{s.calories} ккал</span>
              </div>
              {s.why ? <p className="mt-1 text-xs text-slate-600">{s.why}</p> : null}
            </li>
          ))}
        </ul>
      ) : null}

      {data && !loading && data.suggestions.length === 0 && !data.reason ? (
        <button type="button" className="mt-3 btn btn-secondary text-sm" onClick={() => void load()}>
          Повторить
        </button>
      ) : null}
    </section>
  );
}
