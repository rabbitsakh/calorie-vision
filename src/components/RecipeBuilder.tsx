"use client";

import { useMemo, useState } from "react";
import { trackFirstMealSaveGoal, trackMealSavedGoal } from "@/lib/metrika-funnel";
import { scaleNutritionByPortion } from "@/lib/nutrition";
import { buildQuickMealLogExtras } from "@/lib/quick-meal-log";
import { withBasePath } from "@/lib/paths";
import { scaleRuNutritionToGrams } from "@/lib/ru-nutrition-lookup";
import { useTimezone } from "@/lib/use-timezone";

type Ingredient = {
  id: string;
  name: string;
  grams: string;
  calories: string;
  protein: string;
  fat: string;
  carbs: string;
  fiber: string;
  sugar: string;
};

type RecipeBuilderProps = {
  selectedDate: string;
  onSaved: () => void;
  onLoggedToDiary?: () => void;
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
    fiber: "",
    sugar: "",
  };
}

function num(value: string): number {
  const n = Number(value.replace(",", "."));
  return Number.isFinite(n) ? n : 0;
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

function optionalMacro(value: number): number | null {
  return value > 0 ? round1(value) : null;
}

export function RecipeBuilder({
  selectedDate,
  onSaved,
  onLoggedToDiary,
  embedded = false,
}: RecipeBuilderProps) {
  const timezone = useTimezone();
  const [recipeName, setRecipeName] = useState("");
  const [ingredients, setIngredients] = useState<Ingredient[]>([emptyIngredient()]);
  const [saving, setSaving] = useState(false);
  const [logging, setLogging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [okMsg, setOkMsg] = useState<string | null>(null);
  /** Grams to log; empty = whole recipe (totals.grams). */
  const [logPortionGrams, setLogPortionGrams] = useState("");

  const totals = useMemo(() => {
    return ingredients.reduce(
      (acc, row) => {
        acc.grams += num(row.grams);
        acc.calories += num(row.calories);
        acc.protein += num(row.protein);
        acc.fat += num(row.fat);
        acc.carbs += num(row.carbs);
        acc.fiber += num(row.fiber);
        acc.sugar += num(row.sugar);
        return acc;
      },
      { grams: 0, calories: 0, protein: 0, fat: 0, carbs: 0, fiber: 0, sugar: 0 },
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
      fiber: scaled.fiber > 0 ? String(scaled.fiber) : "",
      sugar: scaled.sugar > 0 ? String(scaled.sugar) : "",
    });
  }

  function validateRecipe(): string | null {
    const name = recipeName.trim();
    if (!name) return "Укажите название блюда";
    if (totals.calories <= 0) return "Добавьте ингредиенты с калориями";
    return null;
  }

  function nutritionPayload(portionOverrideGrams?: number) {
    const baseGrams = totals.grams > 0 ? Math.round(totals.grams) : null;

    if (
      portionOverrideGrams != null &&
      Number.isFinite(portionOverrideGrams) &&
      portionOverrideGrams > 0 &&
      baseGrams != null &&
      baseGrams > 0 &&
      portionOverrideGrams !== baseGrams
    ) {
      const scaled = scaleNutritionByPortion(
        {
          calories: Math.round(totals.calories),
          protein: optionalMacro(totals.protein) ?? undefined,
          fat: optionalMacro(totals.fat) ?? undefined,
          carbs: optionalMacro(totals.carbs) ?? undefined,
          fiber: optionalMacro(totals.fiber) ?? undefined,
          sugar: optionalMacro(totals.sugar) ?? undefined,
          portionGrams: baseGrams,
        },
        portionOverrideGrams,
      );
      if (scaled) {
        return {
          calories: scaled.calories,
          protein: scaled.protein ?? null,
          fat: scaled.fat ?? null,
          carbs: scaled.carbs ?? null,
          fiber: scaled.fiber ?? null,
          sugar: scaled.sugar ?? null,
          portionGrams: Math.round(scaled.portionGrams),
        };
      }
    }

    return {
      calories: Math.round(totals.calories),
      protein: optionalMacro(totals.protein),
      fat: optionalMacro(totals.fat),
      carbs: optionalMacro(totals.carbs),
      fiber: optionalMacro(totals.fiber),
      sugar: optionalMacro(totals.sugar),
      portionGrams: baseGrams,
    };
  }

  async function saveAsCustomFood() {
    setError(null);
    setOkMsg(null);
    const validationError = validateRecipe();
    if (validationError) {
      setError(validationError);
      return;
    }

    setSaving(true);
    try {
      const name = recipeName.trim();
      const nutrition = nutritionPayload();
      const resp = await fetch(withBasePath("/api/custom-foods"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, ...nutrition }),
      });
      if (!resp.ok) {
        const data = (await resp.json().catch(() => ({}))) as { error?: string };
        throw new Error(data.error ?? "Не удалось сохранить");
      }
      setOkMsg("Сохранено в «Мои продукты»");
      setRecipeName("");
      setIngredients([emptyIngredient()]);
      setLogPortionGrams("");
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ошибка сохранения");
    } finally {
      setSaving(false);
    }
  }

  async function addToDiary() {
    setError(null);
    setOkMsg(null);
    const validationError = validateRecipe();
    if (validationError) {
      setError(validationError);
      return;
    }

    const portionRaw = logPortionGrams.trim();
    const portionOverride = portionRaw ? num(portionRaw) : undefined;
    if (portionRaw && (!(portionOverride! > 0))) {
      setError("Укажите порцию больше 0 г");
      return;
    }

    setLogging(true);
    try {
      const name = recipeName.trim();
      const nutrition = nutritionPayload(portionOverride);
      const { mealType, eatenAt } = buildQuickMealLogExtras(selectedDate, timezone);
      const resp = await fetch(withBasePath("/api/meals"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          date: selectedDate,
          dishName: name,
          ...nutrition,
          mealType,
          eatenAt,
        }),
      });
      if (!resp.ok) {
        const data = (await resp.json().catch(() => ({}))) as { error?: string };
        throw new Error(data.error ?? "Не удалось добавить в дневник");
      }
      setOkMsg(
        nutrition.portionGrams
          ? `Добавлено в дневник (${nutrition.portionGrams} г)`
          : "Добавлено в дневник",
      );
      setRecipeName("");
      setIngredients([emptyIngredient()]);
      setLogPortionGrams("");
      trackFirstMealSaveGoal();
      trackMealSavedGoal();
      (onLoggedToDiary ?? onSaved)();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ошибка добавления");
    } finally {
      setLogging(false);
    }
  }

  return (
    <div className={embedded ? "" : "card p-4 md:p-6"}>
      <div>
        <h3 className="text-sm font-semibold text-slate-800">Конструктор рецепта</h3>
        <p className="mt-0.5 text-xs text-slate-500">
          Сложите ингредиенты — подставим КБЖУ и клетчатку/сахар из справочника, если найдём.
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
                <input
                  type="number"
                  min="0"
                  inputMode="decimal"
                  value={row.calories}
                  onChange={(e) => updateIngredient(row.id, { calories: e.target.value })}
                />
              </div>
              <div className="field">
                <label className="text-xs">Белки</label>
                <input
                  type="number"
                  min="0"
                  step="0.1"
                  inputMode="decimal"
                  value={row.protein}
                  onChange={(e) => updateIngredient(row.id, { protein: e.target.value })}
                />
              </div>
              <div className="field">
                <label className="text-xs">Жиры</label>
                <input
                  type="number"
                  min="0"
                  step="0.1"
                  inputMode="decimal"
                  value={row.fat}
                  onChange={(e) => updateIngredient(row.id, { fat: e.target.value })}
                />
              </div>
              <div className="field">
                <label className="text-xs">Углеводы</label>
                <input
                  type="number"
                  min="0"
                  step="0.1"
                  inputMode="decimal"
                  value={row.carbs}
                  onChange={(e) => updateIngredient(row.id, { carbs: e.target.value })}
                />
              </div>
              <div className="field">
                <label className="text-xs">Клетчатка</label>
                <input
                  type="number"
                  min="0"
                  step="0.1"
                  inputMode="decimal"
                  value={row.fiber}
                  onChange={(e) => updateIngredient(row.id, { fiber: e.target.value })}
                />
              </div>
              <div className="field">
                <label className="text-xs">Сахар</label>
                <input
                  type="number"
                  min="0"
                  step="0.1"
                  inputMode="decimal"
                  value={row.sugar}
                  onChange={(e) => updateIngredient(row.id, { sugar: e.target.value })}
                />
              </div>
            </div>
          </li>
        ))}
      </ul>

      <button
        type="button"
        className="btn-quiet mt-2 text-sm text-teal-800"
        onClick={() => setIngredients((prev) => [...prev, emptyIngredient()])}
      >
        + Ещё ингредиент
      </button>

      <div className="mt-3 rounded-xl bg-teal-50/70 px-3 py-2 text-sm text-teal-950">
        Итого: {Math.round(totals.calories)} ккал
        {totals.grams > 0 ? ` · ${Math.round(totals.grams)} г` : ""}
        {totals.protein > 0 || totals.fat > 0 || totals.carbs > 0
          ? ` · Б ${Math.round(totals.protein)} / Ж ${Math.round(totals.fat)} / У ${Math.round(totals.carbs)}`
          : ""}
        {totals.fiber > 0 || totals.sugar > 0
          ? ` · Кл ${round1(totals.fiber)} / Сах ${round1(totals.sugar)}`
          : ""}
      </div>

      <div className="mt-3 field max-w-[12rem]">
        <label className="text-xs">Порция в дневник, г</label>
        <input
          type="number"
          min="1"
          inputMode="decimal"
          value={logPortionGrams}
          onChange={(e) => setLogPortionGrams(e.target.value)}
          placeholder={totals.grams > 0 ? String(Math.round(totals.grams)) : "вся порция"}
        />
        <p className="mt-1 text-[11px] text-slate-500">
          Пусто = весь рецепт
          {totals.grams > 0 ? ` (${Math.round(totals.grams)} г)` : ""}.
        </p>
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          className="btn btn-primary text-sm"
          disabled={saving || logging}
          onClick={() => void addToDiary()}
        >
          {logging ? "Добавляем…" : "Добавить в дневник"}
        </button>
        <button
          type="button"
          className="btn btn-secondary text-sm"
          disabled={saving || logging}
          onClick={() => void saveAsCustomFood()}
        >
          {saving ? "Сохраняем…" : "В избранное"}
        </button>
      </div>

      {error ? <p className="mt-2 text-sm text-red-600">{error}</p> : null}
      {okMsg ? <p className="mt-2 text-sm text-teal-800">{okMsg}</p> : null}
    </div>
  );
}
