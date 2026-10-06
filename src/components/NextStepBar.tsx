"use client";

import { useMemo, useState } from "react";
import { useOptionalRationDay } from "@/components/RationDayProvider";
import { requestOpenFoodAddPicker } from "@/lib/open-food-camera";
import { requestOpenWaterQuick } from "@/lib/open-water-quick";
import { requestOpenWeightQuick } from "@/lib/open-weight-quick";
import {
  clearPostWorkoutNudge,
  hasFreshPostWorkoutNudge,
} from "@/lib/post-workout-nudge";
import { dismissWeekNudge, isWeekNudgeDismissed } from "@/lib/week-nudge-dismiss";

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
 * One soft nudge under the day scene.
 * Never a second photo CTA — food add stays on center «+».
 */
export function NextStepBar({ selectedDate, today }: NextStepBarProps) {
  const day = useOptionalRationDay();
  const [, bump] = useState(0);

  const step = useMemo<SoftStep | null>(() => {
    if (selectedDate !== today) return null;
    const meals = day?.data?.meals;
    const water = day?.data?.water;
    const streak = day?.data?.streak;
    const logged =
      (meals?.entries.length ?? 0) > 0 || Boolean(streak?.loggedToday);
    const hour = new Date().getHours();
    const postWorkout = hasFreshPostWorkoutNudge();

    // After the first meal, nudge weight once so calorie targets appear.
    if (logged && meals && meals.target == null) {
      return {
        label: "Укажите вес — появится норма калорий",
        actionLabel: "Вес",
        onClick: () => requestOpenWeightQuick(),
      };
    }

    const proteinTarget = meals?.target?.protein ?? 0;
    const protein = meals?.totalProtein ?? 0;
    const proteinLow = proteinTarget > 0 && protein < proteinTarget * 0.4;

    // After gym → elevate protein (skip hour gate), priority over water.
    if (postWorkout && logged && proteinLow) {
      return {
        label: "После тренировки — белок",
        actionLabel: "Добавить",
        onClick: () => {
          clearPostWorkoutNudge();
          bump((n) => n + 1);
          requestOpenFoodAddPicker();
        },
      };
    }
    if (postWorkout && logged && proteinTarget > 0 && protein < proteinTarget * 0.7) {
      return {
        label: "После тренировки — доберите белок",
        actionLabel: "Добавить",
        onClick: () => {
          clearPostWorkoutNudge();
          bump((n) => n + 1);
          requestOpenFoodAddPicker();
        },
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

    if (logged && hour >= 14 && proteinLow) {
      return {
        label: "Белка маловато — можно добавить приём",
        actionLabel: "Добавить",
        onClick: () => requestOpenFoodAddPicker(),
      };
    }

    // Mid-week regularity (day 3–6 hole before SevenDayAha) — one soft line.
    const daysThisWeek = streak?.daysLoggedThisWeek ?? 0;
    const weekNudge = streak?.weekNudge?.trim() || null;
    if (
      weekNudge &&
      daysThisWeek >= 3 &&
      daysThisWeek < 7 &&
      !streak?.loggedToday &&
      !isWeekNudgeDismissed(today)
    ) {
      return {
        label: weekNudge,
        actionLabel: "Записать",
        onClick: () => {
          dismissWeekNudge(today);
          bump((n) => n + 1);
          requestOpenFoodAddPicker();
        },
      };
    }

    return null;
  }, [selectedDate, today, day, bump]);

  if (!step) return null;

  return (
    <div className="next-step-bar ration-soft-nudge flex items-center justify-between gap-3 rounded-[var(--radius-md)] border border-[var(--border-hairline)] bg-white/80 px-3.5 py-2.5 shadow-[var(--shadow-card)]">
      <p className="min-w-0 text-sm font-medium text-slate-800">{step.label}</p>
      <button
        type="button"
        className="shrink-0 rounded-[var(--radius-md)] bg-[var(--accent)] px-3.5 py-2 text-xs font-semibold text-white hover:bg-[var(--accent-hover)]"
        onClick={step.onClick}
      >
        {step.actionLabel}
      </button>
    </div>
  );
}
