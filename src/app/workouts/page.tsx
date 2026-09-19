"use client";

import { AppShell } from "@/components/AppShell";
import { AdminGate } from "@/components/AdminGate";
import { AuthGate } from "@/components/AuthGate";
import { BackButton } from "@/components/BackButton";
import { WorkoutsView } from "@/components/WorkoutsView";
import { toDateKeyTz } from "@/lib/dates";
import { useTimezone } from "@/lib/use-timezone";

export default function WorkoutsPage() {
  const timezone = useTimezone();
  const todayKey = toDateKeyTz(new Date(), timezone);

  return (
    <AppShell
      title="Тренировки"
      description="Нагрузка по группам мышц — только для вас."
      headerExtra={<BackButton />}
    >
      <AuthGate>
        <AdminGate>
          <WorkoutsView todayKey={todayKey} />
        </AdminGate>
      </AuthGate>
    </AppShell>
  );
}
