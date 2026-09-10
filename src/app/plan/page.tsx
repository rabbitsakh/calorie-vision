"use client";

import dynamic from "next/dynamic";
import { useState } from "react";
import { AppShell } from "@/components/AppShell";
import { AuthGate } from "@/components/AuthGate";
import { ShareWeekButton } from "@/components/ShareWeekButton";
import { WeeklyPlan } from "@/components/WeeklyPlan";
import { WeeklyReportCard } from "@/components/WeeklyReportCard";
import { WeightGoalCard } from "@/components/WeightGoalCard";
import { toDateKeyTz } from "@/lib/dates";
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
  const today = toDateKeyTz(new Date(), timezone);
  const router = useRouter();
  const [refreshKey, setRefreshKey] = useState(0);

  return (
    <AppShell
      title="План"
      compact
      description="Неделя, цель по весу, покупки."
      date={date}
    >
      <AuthGate>
        <div className="flex flex-col gap-4">
          <div className="flex justify-end">
            <ShareWeekButton endDate={date} className="shrink-0" />
          </div>
          <WeeklyPlan
            selectedDate={date}
            refreshKey={refreshKey}
            showPlanLink={false}
            showHolidayToggle={date === today}
            onHolidayChange={() => setRefreshKey((k) => k + 1)}
            onSelectDate={(next) => {
              router.push(`/ration?date=${next}`);
            }}
          />
          <WeeklyReportCard endDate={date} />
          <WeightGoalCard
            selectedDate={date === today ? today : date}
            refreshKey={refreshKey}
            showCurrentWeight
            onChanged={() => setRefreshKey((k) => k + 1)}
          />
          <ShoppingListPanel selectedDate={date} />
        </div>
      </AuthGate>
    </AppShell>
  );
}
