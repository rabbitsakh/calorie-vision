"use client";

import { AppShell } from "@/components/AppShell";
import { AdminGate } from "@/components/AdminGate";
import { AdminUsersTable } from "@/components/AdminUsersTable";
import { AuthGate } from "@/components/AuthGate";
import { BackButton } from "@/components/BackButton";

export default function AdminUsersPage() {
  return (
    <AppShell
      title="Пользователи"
      description="Все аккаунты приложения."
      headerExtra={<BackButton />}
    >
      <AuthGate>
        <AdminGate>
          <AdminUsersTable />
        </AdminGate>
      </AuthGate>
    </AppShell>
  );
}
