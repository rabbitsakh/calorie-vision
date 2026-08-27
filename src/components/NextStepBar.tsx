"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useOptionalRationDay } from "@/components/RationDayProvider";
import { requestOpenFoodCamera } from "@/lib/open-food-camera";
import { withBasePath } from "@/lib/paths";
import { dayPartFromHour } from "@/lib/splash-tips";

type NextStepBarProps = {
  selectedDate: string;
  today: string;
  onAddFood: () => void;
};

/**
 * One soft CTA under the day hero — food / weight only.
 * Water lives in the compact chip strip just below; do not duplicate +мл here.
 */
export function NextStepBar({ selectedDate, today, onAddFood }: NextStepBarProps) {
  const day = useOptionalRationDay();
  const router = useRouter();
  const [hour, setHour] = useState(() => new Date().getHours());

  useEffect(() => {
    setHour(new Date().getHours());
  }, [selectedDate]);

  const step = useMemo(() => {
    if (selectedDate !== today) return null;
    const meals = day?.data?.meals;
    const logged = (meals?.entries.length ?? 0) > 0 || Boolean(day?.data?.streak?.loggedToday);
    const part = dayPartFromHour(hour);

    if (!logged) {
      return {
        label: part === "morning" ? "Начните день — добавьте завтрак" : "Добавьте первый приём пищи",
        actionLabel: "Фото",
        onClick: () => requestOpenFoodCamera(true),
      };
    }

    // After the first meal, nudge weight once so calorie targets appear.
    if (meals && meals.target == null) {
      return {
        label: "Укажите вес — появится норма калорий",
        actionLabel: "К весу",
        onClick: () => router.push(withBasePath("/weight")),
      };
    }

    return null;
  }, [selectedDate, today, day, hour, router]);

  if (!step) return null;

  return (
    <div className="next-step-bar flex items-center justify-between gap-3 px-1 py-0.5">
      <p className="min-w-0 text-sm font-medium text-slate-700">{step.label}</p>
      <button
        type="button"
        className="shrink-0 rounded-xl bg-teal-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-teal-800"
        onClick={step.onClick}
      >
        {step.actionLabel}
      </button>
    </div>
  );
}
