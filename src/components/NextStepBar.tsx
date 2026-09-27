"use client";

import { useMemo } from "react";
import { useOptionalRationDay } from "@/components/RationDayProvider";
import { requestOpenFoodAddPicker } from "@/lib/open-food-camera";
import { requestOpenWaterQuick } from "@/lib/open-water-quick";
import { requestOpenWeightQuick } from "@/lib/open-weight-quick";

type NextStepBarProps = {
  selectedDate: string;
  today: string;
};

type SoftStep = {
  label: string;
  actionLabel: string;
  onClick: () => void;
};

/**
 * One soft nudge under the day scene (Wave B).
 * Never a second photo CTA — food add stays on center «+».
 */
export function NextStepBar({ selectedDate, today }: NextStepBarProps) {
  const day = useOptionalRationDay();

  const step = useMemo<SoftStep | null>(() => {
    if (selectedDate !== today) return null;
    const meals = day?.data?.meals;
    const water = day?.data?.water;
    const logged =
      (meals?.entries.length ?? 0) > 0 || Boolean(day?.data?.streak?.loggedToday);
    const hour = new Date().getHours();

    // After the first meal, nudge weight once so calorie targets appear.
    if (logged && meals && meals.target == null) {
      return {
        label: "Укажите вес — появится норма калорий",
        actionLabel: "Вес",
        onClick: () => requestOpenWeightQuick(),
      };
    }

    const waterTarget = water?.target ?? 0;
    const waterMl = water?.totalMl ?? 0;
    if (hour >= 11 && waterTarget > 0 && waterMl < waterTarget * 0.35) {
      return {
        label: "Воды пока мало — один стакан уже поможет",
        actionLabel: "Вода",
        onClick: () => requestOpenWaterQuick(),
      };
    }

    const proteinTarget = meals?.target?.protein ?? 0;
    const protein = meals?.totalProtein ?? 0;
    if (
      logged &&
      hour >= 14 &&
      proteinTarget > 0 &&
      protein < proteinTarget * 0.4
    ) {
      return {
        label: "Белка маловато — можно добавить приём",
        actionLabel: "Добавить",
        onClick: () => requestOpenFoodAddPicker(),
      };
    }

    return null;
  }, [selectedDate, today, day]);

  if (!step) return null;

  return (
    <div className="next-step-bar ration-soft-nudge flex items-center justify-between gap-3 px-1 py-1">
      <p className="min-w-0 text-sm font-medium text-slate-700">{step.label}</p>
      <button
        type="button"
        className="shrink-0 rounded-xl bg-teal-800/90 px-3 py-1.5 text-xs font-semibold text-white hover:bg-teal-900"
        onClick={step.onClick}
      >
        {step.actionLabel}
      </button>
    </div>
  );
}
