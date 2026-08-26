"use client";

import { AppShell } from "@/components/AppShell";
import { AuthGate } from "@/components/AuthGate";
import { WeeklyPlan } from "@/components/WeeklyPlan";
import { useSelectedDate } from "@/lib/use-selected-date";
import { useTimezone } from "@/lib/use-timezone";
import { useRouter } from "next/navigation";

export default function PlanPage() {
  const timezone = useTimezone();
  const { date } = useSelectedDate(timezone);
  const router = useRouter();

  return (
    <AppShell
      title="План"
      compact
      description="Неделя: норма и факт по калориям."
      date={date}
    >
      <AuthGate>
        <div className="flex flex-col gap-4">
          <WeeklyPlan
            selectedDate={date}
            onSelectDate={(next) => {
              router.push(`/ration?date=${next}`);
            }}
          />
          <p className="text-sm text-slate-500">
            Нажмите на день, чтобы открыть рацион. Список покупок и шаблоны дня — на странице
            рациона.
          </p>
        </div>
      </AuthGate>
    </AppShell>
  );
}
