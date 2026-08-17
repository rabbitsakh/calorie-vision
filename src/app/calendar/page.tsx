"use client";

import { AppShell } from "@/components/AppShell";
import { AuthGate } from "@/components/AuthGate";
import { DayCalendar } from "@/components/DayCalendar";
import { useSelectedDate } from "@/lib/use-selected-date";

export default function CalendarPage() {
  const { date, setDate } = useSelectedDate();

  return (
    <AppShell
      title="Календарь"
      description="Точки отмечают дни с едой или записанным весом. Нажмите день, чтобы открыть дневник."
      date={date}
    >
      <AuthGate>
        <section className="card p-6">
          <DayCalendar selectedDate={date} onSelect={(next) => setDate(next, "/diary")} />
        </section>
      </AuthGate>
    </AppShell>
  );
}
