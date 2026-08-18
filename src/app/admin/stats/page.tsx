"use client";

import { AdminGate } from "@/components/AdminGate";
import { AdminStatsSummary } from "@/components/AdminStatsSummary";
import { AdminUsersTable } from "@/components/AdminUsersTable";
import { AppShell } from "@/components/AppShell";
import { AuthGate } from "@/components/AuthGate";
import { BackButton } from "@/components/BackButton";

export default function AdminStatsPage() {
  return (
    <AppShell
      title="Статистика"
      description="Сводка по приложению и все пользователи."
      headerExtra={<BackButton />}
    >
      <AuthGate>
        <AdminGate>
          <div className="flex flex-col gap-4 md:gap-6">
            <AdminStatsSummary />
            <AdminUsersTable showCounts />
          </div>
        </AdminGate>
      </AuthGate>
    </AppShell>
  );
}
