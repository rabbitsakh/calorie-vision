"use client";

import { AppShell } from "@/components/AppShell";
import { AuthGate } from "@/components/AuthGate";
import { DateNavBar } from "@/components/DateNavBar";
import { StatsView } from "@/components/StatsView";
import { useSelectedDate } from "@/lib/use-selected-date";
import { useTimezone } from "@/lib/use-timezone";

export default function StatsPage() {
  const timezone = useTimezone();
  const { date, setDate, today } = useSelectedDate(timezone);

  return (
    <AppShell
      title="Статистика"
      compact
      date={date}
      headerExtra={
        <DateNavBar
          date={date}
          today={today}
          onDateChange={setDate}
        />
      }
    >
      <AuthGate>
        <StatsView endDate={date} />
      </AuthGate>
    </AppShell>
  );
}
