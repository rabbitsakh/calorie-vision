"use client";

import dynamic from "next/dynamic";
import { AppShell } from "@/components/AppShell";
import { AuthGate } from "@/components/AuthGate";
import { WeeklyPlan } from "@/components/WeeklyPlan";
import { WeeklyReportCard } from "@/components/WeeklyReportCard";
import { useSelectedDate } from "@/lib/use-selected-date";
import { useTimezone } from "@/lib/use-timezone";
import { useRouter } from "next/navigation";

const ShoppingListPanel = dynamic(
  () => import("@/components/ShoppingListPanel").then((m) => m.ShoppingListPanel),
  { ssr: false },
);

export default function PlanPage() {
  const timezone = useTimezone();
  const { date } = useSelectedDate(timezone);
  const router = useRouter();

  return (
    <AppShell
      title="План"
      compact
      description="Неделя, покупки и спокойный обзор."
      date={date}
    >
      <AuthGate>
        <div className="flex flex-col gap-4">
          <p className="text-sm text-slate-600">
            Норма и факт по калориям. Нажмите на день — откроется рацион.
          </p>
          <WeeklyPlan
            selectedDate={date}
            onSelectDate={(next) => {
              router.push(`/ration?date=${next}`);
            }}
          />
          <WeeklyReportCard endDate={date} />
          <ShoppingListPanel selectedDate={date} />
        </div>
      </AuthGate>
    </AppShell>
  );
}
