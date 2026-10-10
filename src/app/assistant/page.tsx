"use client";

import { AppShell } from "@/components/AppShell";
import { AssistantChat } from "@/components/AssistantChat";
import { AuthGate } from "@/components/AuthGate";
import { BackButton } from "@/components/BackButton";

export default function AssistantPage() {
  return (
    <AppShell
      title="AI‑ассистент"
      description="Рацион, зал, планы и покупки — по твоим данным."
      headerExtra={<BackButton />}
    >
      <AuthGate>
        <AssistantChat />
      </AuthGate>
    </AppShell>
  );
}
