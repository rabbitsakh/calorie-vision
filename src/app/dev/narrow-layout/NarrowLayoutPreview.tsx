"use client";

import { useSearchParams } from "next/navigation";
import { ChestDock } from "@/components/ChestDock";
import { MealListRow } from "@/components/DailyLogMealCards";
import { QuickLogStrip } from "@/components/QuickLogStrip";
import { WaterTracker } from "@/components/WaterTracker";
import type { MealListItem } from "@/lib/meal-groups";
import type { MealEntry, MealType } from "@/types";

const DATE = "2026-11-15";

const LONG_NAMES = [
  "Сырники льняные с клюквой, сметаной и домашний творожный соус",
  "Куриная грудка запечённая с овощами, киноа и йогуртовым соусом",
];

function meal(id: string, dishName: string, mealType: MealType): MealListItem {
  const entry: MealEntry = {
    id,
    date: DATE,
    dishName,
    calories: 420,
    protein: 28,
    fat: 14,
    carbs: 36,
    fiber: 4,
    sugar: 6,
    portionGrams: 210,
    confidence: 0.8,
    imagePath: null,
    mealGroupId: null,
    mealType,
    wasCorrected: false,
    originalDish: null,
    originalCalories: null,
    createdAt: "2026-11-15T08:00:00.000Z",
    eatenAt: "2026-11-15T08:00:00.000Z",
  };
  return { kind: "single", entry };
}

const noop = async () => {};

/**
 * Узкий стенд «Сегодня»: те же карточки, что в дневнике, без входа.
 * Playwright проверяет, что длинные названия не раздвигают экран.
 */
export function NarrowLayoutPreview() {
  const dark = useSearchParams().get("theme") === "dark";
  return (
    <div className={`cv-app-frame${dark ? " today-hero-force-dark" : ""}`}>
      <main className="mx-auto flex w-full max-w-lg flex-col gap-3 px-3 py-3">
        <h1 className="text-lg font-semibold">Сегодня</h1>
        <section className="ration-day-scene flex flex-col gap-3" data-layout-card>
          <MealListRow
            item={meal("m1", LONG_NAMES[0]!, "BREAKFAST")}
            onDelete={() => {}}
            onDeleteGroup={() => {}}
            onEdit={noop}
            onMealTypeChange={noop}
            onEatenAtChange={noop}
            onDuplicate={noop}
            onImageChange={() => {}}
          />
          <MealListRow
            item={meal("m2", LONG_NAMES[1]!, "LUNCH")}
            onDelete={() => {}}
            onDeleteGroup={() => {}}
            onEdit={noop}
            onMealTypeChange={noop}
            onEatenAtChange={noop}
            onDuplicate={noop}
            onImageChange={() => {}}
          />
          <ChestDock selectedDate={DATE} today={DATE} refreshKey={0} />
          <QuickLogStrip selectedDate={DATE} refreshKey={0} mealCount={2} onSaved={() => {}} />
        </section>
        <div data-layout-card>
          <WaterTracker selectedDate={DATE} compact />
        </div>
      </main>
    </div>
  );
}
