"use client";

import { AdminChangelog } from "@/components/AdminChangelog";
import { AdminGate } from "@/components/AdminGate";
import { AppShell } from "@/components/AppShell";
import { AuthGate } from "@/components/AuthGate";
import { BackButton } from "@/components/BackButton";

export default function AdminChangelogPage() {
  return (
    <AppShell
      title="Журнал изменений"
      description="История обновлений Calorie Vision."
      headerExtra={<BackButton />}
    >
      <AuthGate>
        <AdminGate>
          <AdminChangelog />
        </AdminGate>
      </AuthGate>
    </AppShell>
  );
}
