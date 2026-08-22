"use client";

import { useState } from "react";
import { FavoriteFoods } from "@/components/FavoriteFoods";
import { QuickAddMeals } from "@/components/QuickAddMeals";
import { MealSuggestions } from "@/components/MealSuggestions";

type Tab = "again" | "favorites" | "ai";

type QuickAddAgainProps = {
  selectedDate: string;
  refreshKey: number;
  totalCalories: number;
  onSaved: () => void;
};

/**
 * One secondary block for “add again”: yesterday/frequent, favorites, optional AI.
 */
export function QuickAddAgain({
  selectedDate,
  refreshKey,
  totalCalories,
  onSaved,
}: QuickAddAgainProps) {
  const [tab, setTab] = useState<Tab>("again");

  return (
    <section className="card overflow-hidden">
      <div className="flex border-b border-slate-100">
        {(
          [
            { id: "again" as const, label: "Снова" },
            { id: "favorites" as const, label: "Избранное" },
            { id: "ai" as const, label: "AI" },
          ] as const
        ).map((item) => (
          <button
            key={item.id}
            type="button"
            className={`min-h-11 flex-1 px-3 text-sm font-semibold transition-colors ${
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
            onSaved={onSaved}
            embedded
          />
        ) : null}
        {tab === "favorites" ? (
          <FavoriteFoods selectedDate={selectedDate} onSaved={onSaved} embedded />
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
