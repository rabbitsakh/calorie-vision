"use client";

import { useEffect, useMemo } from "react";
import { EveningDaySummaryView } from "@/components/EveningDaySummaryCard";
import { buildEveningDaySummary } from "@/lib/evening-day-summary";
import { setMetrikaConsent } from "@/lib/metrika-consent";

/**
 * Стенд карточки «Итог дня» для скриншотов: тёмная тема через prefers-color-scheme.
 * Цифры считает buildEveningDaySummary, в дневник не пишет.
 */
export function EveningSummaryPreview() {
  useEffect(() => {
    setMetrikaConsent("declined");
  }, []);

  const summary = useMemo(
    () =>
      buildEveningDaySummary({
        totals: {
          calories: 1720,
          protein: 80,
          fat: 55,
          carbs: 180,
          waterMl: 1300,
        },
        targets: {
          calories: 1800,
          protein: 110,
          fat: 60,
          carbs: 200,
          waterMl: 2000,
        },
        history: [
          {
            name: "Творог 5%",
            calories: 180,
            protein: 34,
            fat: 5,
            carbs: 4,
            portionGrams: 200,
            useCount: 6,
          },
          {
            name: "Кефир 1%",
            calories: 80,
            protein: 6,
            fat: 2,
            carbs: 8,
            portionGrams: 200,
            useCount: 4,
          },
          {
            name: "Пирожное",
            calories: 250,
            protein: 3,
            fat: 12,
            carbs: 32,
            portionGrams: 80,
            useCount: 9,
          },
        ],
      }),
    [],
  );

  return (
    <main className="mx-auto w-full max-w-full px-4 py-4">
      <EveningDaySummaryView
        summary={summary}
        busyKey={null}
        notice={null}
        onAdd={() => {}}
        onHide={() => {}}
      />
    </main>
  );
}
