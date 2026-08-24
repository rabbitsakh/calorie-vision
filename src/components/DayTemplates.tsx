"use client";

import { useCallback, useEffect, useState } from "react";
import {
  createDayTemplate,
  deleteDayTemplate,
  loadDayTemplates,
  type DayTemplate,
  type DayTemplateMeal,
} from "@/lib/day-templates";
import { withBasePath } from "@/lib/paths";
import type { MealEntry } from "@/types";

type DayTemplatesProps = {
  selectedDate: string;
  refreshKey: number;
  onSaved: () => void;
};

export function DayTemplates({ selectedDate, refreshKey, onSaved }: DayTemplatesProps) {
  const [templates, setTemplates] = useState<DayTemplate[]>([]);
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);
  const [applying, setApplying] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dayMeals, setDayMeals] = useState<DayTemplateMeal[]>([]);

  const refreshTemplates = useCallback(() => {
    setTemplates(loadDayTemplates());
  }, []);

  useEffect(() => {
    refreshTemplates();
  }, [refreshTemplates, refreshKey]);

  useEffect(() => {
    void (async () => {
      try {
        const resp = await fetch(withBasePath(`/api/meals?date=${selectedDate}`), {
          cache: "no-store",
        });
        if (!resp.ok) return;
        const data = (await resp.json()) as { entries?: MealEntry[] };
        setDayMeals(
          (data.entries ?? []).map((e) => ({
            dishName: e.dishName,
            calories: e.calories,
            protein: e.protein,
            fat: e.fat,
            carbs: e.carbs,
            fiber: e.fiber,
            sugar: e.sugar,
            portionGrams: e.portionGrams,
            mealType: e.mealType,
          })),
        );
      } catch {
        // non-critical
      }
    })();
  }, [selectedDate, refreshKey]);

  function handleSave() {
    if (dayMeals.length === 0) {
      setError("В дневнике за этот день нет блюд");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      createDayTemplate(name || `День ${selectedDate}`, dayMeals);
      setName("");
      refreshTemplates();
    } finally {
      setSaving(false);
    }
  }

  async function handleApply(template: DayTemplate) {
    setApplying(template.id);
    setError(null);
    try {
      for (const meal of template.meals) {
        const resp = await fetch(withBasePath("/api/meals"), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            date: selectedDate,
            dishName: meal.dishName,
            calories: meal.calories,
            protein: meal.protein,
            fat: meal.fat,
            carbs: meal.carbs,
            fiber: meal.fiber,
            sugar: meal.sugar,
            portionGrams: meal.portionGrams,
            mealType: meal.mealType,
          }),
        });
        if (!resp.ok) {
          setError("Не удалось применить шаблон");
          return;
        }
      }
      onSaved();
    } finally {
      setApplying(null);
    }
  }

  function handleDelete(id: string) {
    deleteDayTemplate(id);
    refreshTemplates();
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="text-xs text-slate-500">
        Сохраните текущий день как шаблон и применяйте его позже. Хранится только на этом устройстве.
      </p>

      <div className="flex flex-wrap items-end gap-2">
        <div className="field min-w-[10rem] flex-1">
          <label className="text-xs">Название шаблона</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={`День ${selectedDate}`}
          />
        </div>
        <button
          type="button"
          className="btn btn-on-tint text-sm text-teal-800"
          disabled={saving || dayMeals.length === 0}
          onClick={handleSave}
        >
          {saving ? "Сохраняем…" : `Сохранить день (${dayMeals.length})`}
        </button>
      </div>

      {error ? <p className="text-xs text-red-600">{error}</p> : null}

      {templates.length === 0 ? (
        <p className="text-sm text-slate-500">Пока нет шаблонов — сохраните заполненный день.</p>
      ) : (
        <ul className="divide-y divide-slate-100">
          {templates.map((tpl) => (
            <li key={tpl.id} className="flex items-center gap-3 py-2.5">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-slate-800">{tpl.name}</p>
                <p className="text-xs text-slate-500">
                  {tpl.meals.length}{" "}
                  {tpl.meals.length === 1 ? "блюдо" : tpl.meals.length < 5 ? "блюда" : "блюд"}
                  {" · "}
                  {tpl.meals.reduce((s, m) => s + m.calories, 0)} ккал
                </p>
              </div>
              <button
                type="button"
                className="shrink-0 rounded-lg bg-teal-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-teal-700 disabled:opacity-60"
                disabled={applying !== null}
                onClick={() => void handleApply(tpl)}
              >
                {applying === tpl.id ? "…" : "Применить"}
              </button>
              <button
                type="button"
                className="shrink-0 rounded-lg px-2 py-1.5 text-xs font-semibold text-slate-500 hover:bg-red-50 hover:text-red-600"
                disabled={applying !== null}
                onClick={() => handleDelete(tpl.id)}
              >
                Удалить
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
