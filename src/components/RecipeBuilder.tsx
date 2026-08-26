"use client";

import { useMemo, useState } from "react";
import { withBasePath } from "@/lib/paths";
import { scaleRuNutritionToGrams } from "@/lib/ru-nutrition-lookup";

type Ingredient = {
  id: string;
  name: string;
  grams: string;
  calories: string;
  protein: string;
  fat: string;
  carbs: string;
};

type RecipeBuilderProps = {
  onSaved: () => void;
  embedded?: boolean;
};

function emptyIngredient(): Ingredient {
  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    name: "",
    grams: "",
    calories: "",
    protein: "",
    fat: "",
    carbs: "",
  };
}

function num(value: string): number {
  const n = Number(value.replace(",", "."));
  return Number.isFinite(n) ? n : 0;
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

export function RecipeBuilder({ onSaved, embedded = false }: RecipeBuilderProps) {
  const [recipeName, setRecipeName] = useState("");
  const [ingredients, setIngredients] = useState<Ingredient[]>([emptyIngredient()]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [okMsg, setOkMsg] = useState<string | null>(null);

  const totals = useMemo(() => {
    return ingredients.reduce(
      (acc, row) => {
        acc.grams += num(row.grams);
        acc.calories += num(row.calories);
        acc.protein += num(row.protein);
        acc.fat += num(row.fat);
        acc.carbs += num(row.carbs);
        return acc;
      },
      { grams: 0, calories: 0, protein: 0, fat: 0, carbs: 0 },
    );
  }, [ingredients]);

  function updateIngredient(id: string, patch: Partial<Ingredient>) {
    setIngredients((prev) => prev.map((row) => (row.id === id ? { ...row, ...patch } : row)));
  }

  function autofillFromLookup(id: string, name: string, gramsRaw: string) {
    const grams = num(gramsRaw);
    const scaled = scaleRuNutritionToGrams(name, grams > 0 ? grams : 100);
    if (!scaled) return;
    updateIngredient(id, {
      name,
      grams: grams > 0 ? gramsRaw : "100",
      calories: String(scaled.calories),
      protein: String(scaled.protein),
      fat: String(scaled.fat),
      carbs: String(scaled.carbs),
    });
  }

  async function saveAsCustomFood() {
    setError(null);
    setOkMsg(null);
    const name = recipeName.trim();
    if (!name) {
      setError("Укажите название блюда");
      return;
    }
    if (totals.calories <= 0) {
      setError("Добавьте ингредиенты с калориями");
      return;
    }

    setSaving(true);
    try {
      const resp = await fetch(withBasePath("/api/custom-foods"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          calories: Math.round(totals.calories),
          protein: totals.protein > 0 ? round1(totals.protein) : null,
          fat: totals.fat > 0 ? round1(totals.fat) : null,
          carbs: totals.carbs > 0 ? round1(totals.carbs) : null,
          portionGrams: totals.grams > 0 ? Math.round(totals.grams) : null,
        }),
      });
      if (!resp.ok) {
        const data = (await resp.json().catch(() => ({}))) as { error?: string };
        throw new Error(data.error ?? "Не удалось сохранить");
      }
      setOkMsg("Сохранено в «Мои продукты»");
      setRecipeName("");
      setIngredients([emptyIngredient()]);
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ошибка сохранения");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className={embedded ? "" : "card p-4 md:p-6"}>
      <div>
        <h3 className="text-sm font-semibold text-slate-800">Конструктор рецепта</h3>
        <p className="mt-0.5 text-xs text-slate-500">
          Сложите ингредиенты — подставим КБЖУ из справочника, если найдём. Сохраним сумму как свой продукт.
        </p>
      </div>

      <div className="mt-3 field">
        <label className="text-xs">Название блюда</label>
        <input
          value={recipeName}
          onChange={(e) => setRecipeName(e.target.value)}
          placeholder="Например: Овсянка с бананом"
        />
      </div>

      <ul className="mt-3 flex flex-col gap-3">
        {ingredients.map((row, index) => (
          <li key={row.id} className="rounded-xl border border-slate-100 bg-slate-50/60 p-3">
            <div className="mb-2 flex items-center justify-between gap-2">
              <span className="text-xs font-medium text-slate-600">Ингредиент {index + 1}</span>
              {ingredients.length > 1 ? (
                <button
                  type="button"
                  className="text-xs text-red-600 hover:underline"
                  onClick={() => setIngredients((prev) => prev.filter((i) => i.id !== row.id))}
                >
                  Убрать
                </button>
              ) : null}
            </div>
            <div className="grid gap-2 sm:grid-cols-3">
              <div className="field sm:col-span-3">
                <label className="text-xs">Название</label>
                <input
                  value={row.name}
                  onChange={(e) => updateIngredient(row.id, { name: e.target.value })}
                  onBlur={() => autofillFromLookup(row.id, row.name, row.grams)}
                  placeholder="Гречка варёная"
                />
              </div>
              <div className="field">
                <label className="text-xs">Граммы</label>
                <input
                  type="number"
                  min="0"
                  inputMode="decimal"
                  value={row.grams}
                  onChange={(e) => updateIngredient(row.id, { grams: e.target.value })}
                  onBlur={() => autofillFromLookup(row.id, row.name, row.grams)}
                />
              </div>
              <div className="field">
                <label className="text-xs">Ккал</label>
                <input type="number" min="0" inputMode="decimal" value={row.calories} onChange={(e) => updateIngredient(row.id, { calories: e.target.value })} />
              </div>
              <div className="field">
                <label className="text-xs">Белки</label>
                <input type="number" min="0" step="0.1" inputMode="decimal" value={row.protein} onChange={(e) => updateIngredient(row.id, { protein: e.target.value })} />
              </div>
              <div className="field">
                <label className="text-xs">Жиры</label>
                <input type="number" min="0" step="0.1" inputMode="decimal" value={row.fat} onChange={(e) => updateIngredient(row.id, { fat: e.target.value })} />
              </div>
              <div className="field">
                <label className="text-xs">Углеводы</label>
                <input type="number" min="0" step="0.1" inputMode="decimal" value={row.carbs} onChange={(e) => updateIngredient(row.id, { carbs: e.target.value })} />
              </div>
            </div>
          </li>
        ))}
      </ul>

      <button type="button" className="btn-quiet mt-2 text-sm text-teal-800" onClick={() => setIngredients((prev) => [...prev, emptyIngredient()])}>
        + Ещё ингредиент
      </button>

      <div className="mt-3 rounded-xl bg-teal-50/70 px-3 py-2 text-sm text-teal-950">
        Итого: {Math.round(totals.calories)} ккал
        {totals.grams > 0 ? ` · ${Math.round(totals.grams)} г` : ""}
        {totals.protein > 0 || totals.fat > 0 || totals.carbs > 0
          ? ` · Б ${Math.round(totals.protein)} / Ж ${Math.round(totals.fat)} / У ${Math.round(totals.carbs)}`
          : ""}
      </div>

      <button type="button" className="btn btn-primary mt-3 text-sm" disabled={saving} onClick={() => void saveAsCustomFood()}>
        {saving ? "Сохраняем…" : "Сохранить как мой продукт"}
      </button>

      {error ? <p className="mt-2 text-sm text-red-600">{error}</p> : null}
      {okMsg ? <p className="mt-2 text-sm text-teal-800">{okMsg}</p> : null}
    </div>
  );
}
