"use client";

import { AppShell } from "@/components/AppShell";
import { AuthGate } from "@/components/AuthGate";
import { StatsView } from "@/components/StatsView";
import { useSelectedDate } from "@/lib/use-selected-date";

export default function StatsPage() {
  const { date } = useSelectedDate();

  return (
    <AppShell
      title="Статистика"
      description="Калории и вес за неделю или месяц."
      date={date}
    >
      <AuthGate>
        <StatsView endDate={date} />
      </AuthGate>
    </AppShell>
  );
}
