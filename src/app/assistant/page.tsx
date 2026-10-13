"use client";

import { Suspense } from "react";
import { AppShell } from "@/components/AppShell";
import { AssistantChat } from "@/components/AssistantChat";
import { AuthGate } from "@/components/AuthGate";
import { BackButton } from "@/components/BackButton";
import { SceneSkeleton } from "@/components/SceneSkeleton";

export default function AssistantPage() {
  return (
    <AppShell
      title="AI‑ассистент"
      description="Живой чат: рацион, зал, вода, вес, фото — с записью и отменой."
      headerExtra={<BackButton />}
    >
      <AuthGate>
        <Suspense fallback={<SceneSkeleton compact label="Открываем ассистента…" />}>
          <AssistantChat />
        </Suspense>
      </AuthGate>
    </AppShell>
  );
}
