"use client";

import { useCallback, useEffect, useState } from "react";
import { withBasePath } from "@/lib/paths";
import { hidePanelToday, isPanelHiddenToday, showPanelToday } from "@/lib/panel-visibility";

const PANEL_ID = "favorites";

type CustomFood = {
  id: string;
  name: string;
  calories: number;
  protein: number | null;
  fat: number | null;
  carbs: number | null;
  portionGrams: number | null;
  useCount: number;
};

type FavoriteFoodsProps = {
  selectedDate: string;
  onSaved: () => void;
};

function TrashIcon() {
  return (
    <svg aria-hidden="true" className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M3 6h18" strokeLinecap="round" /><path d="M8 6V4h8v2" />
      <path d="M19 6l-1 14H6L5 6" /><path d="M10 11v6" strokeLinecap="round" /><path d="M14 11v6" strokeLinecap="round" />
    </svg>
  );
}

export function FavoriteFoods({ selectedDate, onSaved }: FavoriteFoodsProps) {
  const [foods, setFoods] = useState<CustomFood[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    setHidden(isPanelHiddenToday(PANEL_ID, selectedDate));
  }, [selectedDate]);
  const [name, setName] = useState("");
  const [calories, setCalories] = useState("");
  const [protein, setProtein] = useState("");
  const [fat, setFat] = useState("");
  const [carbs, setCarbs] = useState("");
  const [portionGrams, setPortionGrams] = useState("");

  const load = useCallback(async () => {
    try {
      const resp = await fetch(withBasePath("/api/custom-foods"));
      if (!resp.ok) return;
      const data = (await resp.json()) as { foods: CustomFood[] };
      setFoods(data.foods);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  async function handleAdd() {
    setAdding(true);
    try {
      const resp = await fetch(withBasePath("/api/custom-foods"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          calories: Number(calories),
          protein: protein ? Number(protein) : null,
          fat: fat ? Number(fat) : null,
          carbs: carbs ? Number(carbs) : null,
          portionGrams: portionGrams ? Number(portionGrams) : null,
        }),
      });
      if (resp.ok) {
        setName(""); setCalories(""); setProtein(""); setFat(""); setCarbs(""); setPortionGrams("");
        setShowForm(false);
        await load();
      }
    } finally {
      setAdding(false);
    }
  }

  async function useFood(food: CustomFood) {
    await fetch(withBasePath("/api/meals"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        date: selectedDate,
        dishName: food.name,
        calories: food.calories,
        protein: food.protein,
        fat: food.fat,
        carbs: food.carbs,
        portionGrams: food.portionGrams,
      }),
    });
    void fetch(withBasePath(`/api/custom-foods/${food.id}/use`), { method: "POST" });
    onSaved();
  }

  async function deleteFood(id: string) {
    await fetch(withBasePath("/api/custom-foods"), {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    await load();
  }

  if (hidden) {
    return (
      <button
        type="button"
        className="flex w-full items-center justify-between gap-2 rounded-2xl border border-dashed border-slate-200 px-4 py-2.5 text-sm text-slate-400 hover:border-slate-300"
        onClick={() => { showPanelToday(PANEL_ID, selectedDate); setHidden(false); }}
      >
        <span>⭐ Мои продукты</span>
        <span className="text-xs">Показать</span>
      </button>
    );
  }

  return (
    <section className="card p-4 md:p-6">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-base font-semibold">Мои продукты</h2>
        <div className="flex gap-2">
        <button
          type="button"
          className="btn btn-secondary text-sm"
          onClick={() => setShowForm(!showForm)}
        >
          {showForm ? "Отмена" : "+ Добавить"}
        </button>
        <button
          type="button"
          className="text-xs text-slate-400 hover:text-slate-600"
          onClick={() => { hidePanelToday(PANEL_ID, selectedDate); setHidden(true); }}
        >
          Скрыть
        </button>
        </div>
      </div>

      {showForm ? (
        <div className="mt-3 grid gap-2 rounded-2xl border border-teal-100 bg-teal-50/30 p-3 sm:grid-cols-2">
          <div className="field sm:col-span-2">
            <label className="text-xs">Название</label>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Омлет домашний" />
          </div>
          <div className="field">
            <label className="text-xs">Ккал</label>
            <input type="number" min="1" value={calories} onChange={(e) => setCalories(e.target.value)} />
          </div>
          <div className="field">
            <label className="text-xs">Порция, г</label>
            <input type="number" min="1" value={portionGrams} onChange={(e) => setPortionGrams(e.target.value)} />
          </div>
          <div className="field">
            <label className="text-xs">Белки, г</label>
            <input type="number" min="0" step="0.1" value={protein} onChange={(e) => setProtein(e.target.value)} />
          </div>
          <div className="field">
            <label className="text-xs">Жиры, г</label>
            <input type="number" min="0" step="0.1" value={fat} onChange={(e) => setFat(e.target.value)} />
          </div>
          <div className="field sm:col-span-2">
            <label className="text-xs">Углеводы, г</label>
            <input type="number" min="0" step="0.1" value={carbs} onChange={(e) => setCarbs(e.target.value)} />
          </div>
          <div className="sm:col-span-2">
            <button
              type="button"
              className="btn btn-primary text-sm"
              disabled={adding || !name.trim() || !calories}
              onClick={() => void handleAdd()}
            >
              {adding ? "Сохраняем..." : "Сохранить продукт"}
            </button>
          </div>
        </div>
      ) : null}

      {loading ? <p className="mt-3 text-sm text-slate-500">Загрузка...</p> : null}

      {!loading && foods.length === 0 && !showForm ? (
        <p className="mt-3 text-sm text-slate-500">
          Нет сохранённых продуктов. Добавьте часто едите — можно будет быстро занести в дневник.
        </p>
      ) : null}

      {foods.length > 0 ? (
        <ul className="mt-3 divide-y divide-slate-100">
          {foods.map((food) => (
            <li key={food.id} className="flex items-center gap-3 py-2">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{food.name}</p>
                <p className="text-xs text-slate-500">
                  {food.calories} ккал
                  {food.portionGrams ? ` · ${food.portionGrams} г` : ""}
                  {food.useCount > 1 ? ` · использовано ${food.useCount}×` : ""}
                </p>
              </div>
              <button
                type="button"
                className="shrink-0 rounded-lg bg-teal-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-teal-700"
                onClick={() => void useFood(food)}
              >
                + В дневник
              </button>
              <button
                type="button"
                className="shrink-0 rounded-lg p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600"
                onClick={() => void deleteFood(food.id)}
              >
                <TrashIcon />
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}
