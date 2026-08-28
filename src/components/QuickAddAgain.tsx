"use client";

import { useCallback, useEffect, useState } from "react";
import { DayTemplates } from "@/components/DayTemplates";
import { FavoriteFoods } from "@/components/FavoriteFoods";
import { RecipeBuilder } from "@/components/RecipeBuilder";
import { QuickAddMeals } from "@/components/QuickAddMeals";
import { MealSuggestions } from "@/components/MealSuggestions";
import { emitMascotReaction } from "@/lib/mascot-reactions";
import { withBasePath } from "@/lib/paths";

type Tab = "again" | "favorites" | "recipe" | "templates" | "ai";

type QuickAddAgainProps = {
  selectedDate: string;
  refreshKey: number;
  totalCalories: number;
  onSaved: () => void;
};

/**
 * One secondary block for “add again”: yesterday/frequent, favorites, templates, optional AI.
 */
export function QuickAddAgain({
  selectedDate,
  refreshKey,
  totalCalories,
  onSaved,
}: QuickAddAgainProps) {
  const [tab, setTab] = useState<Tab>("again");
  const [favoritesCount, setFavoritesCount] = useState(0);

  const loadFavoritesCount = useCallback(async () => {
    try {
      const resp = await fetch(withBasePath("/api/custom-foods"));
      if (!resp.ok) return;
      const data = (await resp.json()) as { foods?: unknown[] };
      setFavoritesCount(Array.isArray(data.foods) ? data.foods.length : 0);
    } catch {
      // non-critical
    }
  }, []);

  useEffect(() => {
    void loadFavoritesCount();
  }, [loadFavoritesCount, refreshKey]);

  function handleSaved() {
    void loadFavoritesCount();
    emitMascotReaction("save");
    onSaved();
  }

  return (
    <section className="card overflow-hidden">
      <div className="border-b border-slate-100 px-4 py-3 md:px-5">
        <h2 className="text-sm font-semibold text-slate-800">Быстрое добавление</h2>
        <p className="mt-0.5 text-xs text-slate-500">
          Повтор вчерашнего, избранное, шаблоны дня или подсказка AI
        </p>
      </div>
      <div className="flex border-b border-slate-100 overflow-x-auto">
        {(
          [
            { id: "again" as const, label: "Снова" },
            {
              id: "favorites" as const,
              label: favoritesCount > 0 ? `Избранное (${favoritesCount})` : "Избранное",
            },
            { id: "recipe" as const, label: "Рецепт" },
            { id: "templates" as const, label: "Шаблоны" },
            { id: "ai" as const, label: "AI" },
          ] as const
        ).map((item) => (
          <button
            key={item.id}
            type="button"
            className={`min-h-11 shrink-0 flex-1 px-3 text-sm font-semibold transition-colors ${
              tab === item.id
                ? "border-b-2 border-teal-700 text-teal-800"
                : "text-slate-500 hover:text-slate-700"
            }`}
            onClick={() => setTab(item.id)}
          >
            {item.label}
          </button>
        ))}
      </div>

      <div className="p-4 md:p-5">
        {tab === "again" ? (
          <QuickAddMeals
            selectedDate={selectedDate}
            refreshKey={refreshKey}
            onSaved={handleSaved}
            embedded
          />
        ) : null}
        {tab === "favorites" ? (
          <FavoriteFoods selectedDate={selectedDate} onSaved={handleSaved} embedded />
        ) : null}
        {tab === "recipe" ? (
          <RecipeBuilder selectedDate={selectedDate} onSaved={handleSaved} onLoggedToDiary={handleSaved} embedded />
        ) : null}
        {tab === "templates" ? (
          <DayTemplates
            selectedDate={selectedDate}
            refreshKey={refreshKey}
            onSaved={handleSaved}
          />
        ) : null}
        {tab === "ai" ? (
          <MealSuggestions
            selectedDate={selectedDate}
            totalCalories={totalCalories}
            embedded
          />
        ) : null}
      </div>
    </section>
  );
}
