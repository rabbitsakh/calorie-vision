"use client";

import { useCallback, useEffect, useState } from "react";
import { DayTemplates } from "@/components/DayTemplates";
import { FavoriteFoods } from "@/components/FavoriteFoods";
import { RecipeBuilder } from "@/components/RecipeBuilder";
import { QuickAddMeals } from "@/components/QuickAddMeals";
import { MealSuggestions } from "@/components/MealSuggestions";
import { emitMascotReaction } from "@/lib/mascot-reactions";
import { withBasePath } from "@/lib/paths";

type MainTab = "again" | "favorites" | "templates" | "more";
type MoreTab = "recipe" | "ai";

type QuickAddAgainProps = {
  selectedDate: string;
  refreshKey: number;
  totalCalories: number;
  onSaved: () => void;
};

/**
 * One secondary block for “add again”: yesterday/frequent, favorites, templates;
 * Recipe + AI nested under «Ещё».
 */
export function QuickAddAgain({
  selectedDate,
  refreshKey,
  totalCalories,
  onSaved,
}: QuickAddAgainProps) {
  const [tab, setTab] = useState<MainTab>("again");
  const [moreTab, setMoreTab] = useState<MoreTab>("recipe");
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
          Повтор вчерашнего, избранное или шаблоны дня
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
            { id: "templates" as const, label: "Шаблоны" },
            { id: "more" as const, label: "Ещё" },
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
        {tab === "templates" ? (
          <DayTemplates
            selectedDate={selectedDate}
            refreshKey={refreshKey}
            onSaved={handleSaved}
          />
        ) : null}
        {tab === "more" ? (
          <div className="flex flex-col gap-3">
            <div className="flex gap-2">
              {(
                [
                  { id: "recipe" as const, label: "Рецепт" },
                  { id: "ai" as const, label: "AI" },
                ] as const
              ).map((item) => (
                <button
                  key={item.id}
                  type="button"
                  className={`rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${
                    moreTab === item.id
                      ? "bg-teal-700 text-white"
                      : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                  }`}
                  onClick={() => setMoreTab(item.id)}
                >
                  {item.label}
                </button>
              ))}
            </div>
            {moreTab === "recipe" ? (
              <RecipeBuilder
                selectedDate={selectedDate}
                onSaved={handleSaved}
                onLoggedToDiary={handleSaved}
                embedded
              />
            ) : null}
            {moreTab === "ai" ? (
              <MealSuggestions
                selectedDate={selectedDate}
                totalCalories={totalCalories}
                embedded
                onSaved={handleSaved}
              />
            ) : null}
          </div>
        ) : null}
      </div>
    </section>
  );
}
