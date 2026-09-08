"use client";

import { useMemo } from "react";
import { useRouter } from "next/navigation";
import { useOptionalRationDay } from "@/components/RationDayProvider";
import { withBasePath } from "@/lib/paths";

type NextStepBarProps = {
  selectedDate: string;
  today: string;
};

/**
 * Soft nudge under the day hero — weight only (Wave C3).
 * Food add lives on the center «+»; do not compete with a second photo CTA.
 */
export function NextStepBar({ selectedDate, today }: NextStepBarProps) {
  const day = useOptionalRationDay();
  const router = useRouter();

  const step = useMemo(() => {
    if (selectedDate !== today) return null;
    const meals = day?.data?.meals;
    const logged = (meals?.entries.length ?? 0) > 0 || Boolean(day?.data?.streak?.loggedToday);

    // After the first meal, nudge weight once so calorie targets appear.
    if (logged && meals && meals.target == null) {
      return {
        label: "Укажите вес — появится норма калорий",
        actionLabel: "К весу",
        onClick: () => router.push(withBasePath("/weight")),
      };
    }

    return null;
  }, [selectedDate, today, day, router]);

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
