"use client";

import { AdminAssistantChat } from "@/components/AdminAssistantChat";
import { AdminGate } from "@/components/AdminGate";
import { AppShell } from "@/components/AppShell";
import { AuthGate } from "@/components/AuthGate";
import { BackButton } from "@/components/BackButton";

export default function AdminAssistantPage() {
  return (
    <AppShell
      title="AI‑ассистент"
      description="Чат по твоему рациону и тренировкам."
      headerExtra={<BackButton />}
    >
      <AuthGate>
        <AdminGate>
          <AdminAssistantChat />
        </AdminGate>
      </AuthGate>
    </AppShell>
  );
}
