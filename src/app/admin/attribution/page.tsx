"use client";

import { AdminAttributionReport } from "@/components/AdminAttributionReport";
import { AdminGate } from "@/components/AdminGate";
import { AppShell } from "@/components/AppShell";
import { AuthGate } from "@/components/AuthGate";
import { BackButton } from "@/components/BackButton";

export default function AdminAttributionPage() {
  return (
    <AppShell
      title="Источники"
      description="Откуда пришли регистрации: utm с рекламного экрана /go."
      headerExtra={<BackButton />}
    >
      <AuthGate>
        <AdminGate>
          <AdminAttributionReport />
        </AdminGate>
      </AuthGate>
    </AppShell>
  );
}
