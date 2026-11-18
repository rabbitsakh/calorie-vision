"use client";

import { FoodConfirmCard } from "@/components/FoodConfirmCard";
import { foodConfirmFromQuickMeal } from "@/lib/food-confirm";

/** Карточка записи, как после разбора «Скумбрия» без порции. Только для e2e и скриншотов. */
export function FoodConfirmPreview({ mode }: { mode: "per100" | "total" }) {
  const dish =
    mode === "per100"
      ? foodConfirmFromQuickMeal({
          name: "Скумбрия",
          unit: "г",
          per100: { calories: 200, protein: 20, fat: 15, carbs: 0 },
        })
      : foodConfirmFromQuickMeal({
          name: "Скумбрия",
          unit: "г",
          kcal: 200,
          protein: 20,
          fat: 15,
          carbs: 0,
        });

  return (
    <div className="min-h-screen bg-[var(--bg)] px-3 py-4">
      <FoodConfirmCard dishes={[dish]} date="2026-11-18" source="chat" />
    </div>
  );
}
