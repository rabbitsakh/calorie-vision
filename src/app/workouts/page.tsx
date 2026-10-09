"use client";

import { useState } from "react";
import { AppShell } from "@/components/AppShell";
import { AuthGate } from "@/components/AuthGate";
import { DateNavBar } from "@/components/DateNavBar";
import { OfflineMealQueueBanner } from "@/components/OfflineMealQueueBanner";
import { WorkoutsView } from "@/components/WorkoutsView";
import { useSelectedDate } from "@/lib/use-selected-date";
import { useTimezone } from "@/lib/use-timezone";

export default function WorkoutsPage() {
  const timezone = useTimezone();
  const { date, setDate, today } = useSelectedDate(timezone);
  const [flushKey, setFlushKey] = useState(0);

  return (
    <AppShell
      title="Зал"
      compact
      description="Тренировки: силовые и кардио, шаблоны, прогрессия."
      date={date}
      headerExtra={
        <DateNavBar date={date} today={today} onDateChange={setDate} />
      }
    >
      <AuthGate>
        <div className="mb-3">
          <OfflineMealQueueBanner
            selectedDate={date}
            onFlushed={() => setFlushKey((k) => k + 1)}
          />
        </div>
        <WorkoutsView
          todayKey={today}
          selectedDate={date}
          queueFlushKey={flushKey}
        />
      </AuthGate>
    </AppShell>
  );
}
