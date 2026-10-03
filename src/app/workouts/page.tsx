"use client";

import { AppShell } from "@/components/AppShell";
import { AuthGate } from "@/components/AuthGate";
import { DateNavBar } from "@/components/DateNavBar";
import { WorkoutsView } from "@/components/WorkoutsView";
import { useSelectedDate } from "@/lib/use-selected-date";
import { useTimezone } from "@/lib/use-timezone";

export default function WorkoutsPage() {
  const timezone = useTimezone();
  const { date, setDate, today } = useSelectedDate(timezone);

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
        <WorkoutsView todayKey={today} selectedDate={date} />
      </AuthGate>
    </AppShell>
  );
}
