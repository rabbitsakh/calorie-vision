"use client";

import { useState } from "react";
import { AppShell } from "@/components/AppShell";
import { AuthGate } from "@/components/AuthGate";
import { DateNavBar } from "@/components/DateNavBar";
import { DailyLog } from "@/components/DailyLog";
import { FoodAddPanel } from "@/components/FoodAddPanel";
import { useSelectedDate } from "@/lib/use-selected-date";
import { useTimezone } from "@/lib/use-timezone";

export default function RationPage() {
  const timezone = useTimezone();
  const { date, setDate, today } = useSelectedDate(timezone);
  const [refreshKey, setRefreshKey] = useState(0);

  return (
    <AppShell
      title="Рацион"
      description="Добавляйте еду и смотрите дневник за выбранный день."
      date={date}
      headerExtra={
        <DateNavBar
          date={date}
          today={today}
          refreshKey={refreshKey}
          onDateChange={(next) => setDate(next)}
        />
      }
    >
      <AuthGate>
        <div className="flex flex-col gap-4 md:gap-6">
          <FoodAddPanel
            selectedDate={date}
            onSaved={() => setRefreshKey((value) => value + 1)}
          />
          <DailyLog
            selectedDate={date}
            refreshKey={refreshKey}
            compact
            timezone={timezone}
            onChanged={() => setRefreshKey((value) => value + 1)}
          />
        </div>
      </AuthGate>
    </AppShell>
  );
}
