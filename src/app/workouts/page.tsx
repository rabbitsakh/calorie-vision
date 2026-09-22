"use client";

import { AppShell } from "@/components/AppShell";
import { AuthGate } from "@/components/AuthGate";
import { WorkoutsView } from "@/components/WorkoutsView";
import { toDateKeyTz } from "@/lib/dates";
import { useTimezone } from "@/lib/use-timezone";

export default function WorkoutsPage() {
  const timezone = useTimezone();
  const todayKey = toDateKeyTz(new Date(), timezone);

  return (
    <AppShell
      title="Зал"
      compact
      description="Тренировки: силовые и кардио, шаблоны, прогрессия."
    >
      <AuthGate>
        <WorkoutsView todayKey={todayKey} />
      </AuthGate>
    </AppShell>
  );
}
