"use client";

import { useState } from "react";
import { AppShell } from "@/components/AppShell";
import { AuthGate } from "@/components/AuthGate";
import { ConfirmationCard } from "@/components/ConfirmationCard";
import { PhotoUploader } from "@/components/PhotoUploader";
import { useSelectedDate } from "@/lib/use-selected-date";
import type { RecognitionResponse } from "@/types";

export default function HomePage() {
  const { date } = useSelectedDate();
  const [pendingResult, setPendingResult] = useState<RecognitionResponse | null>(null);

  return (
    <AppShell
      title="Добавить приём пищи"
      description="Загрузите фото еды — GigaChat определит блюдо и калорийность."
      date={date}
    >
      <AuthGate>
        <div className="flex flex-col gap-6">
          <PhotoUploader
            disabled={Boolean(pendingResult)}
            onRecognized={(result) => setPendingResult(result)}
          />
          {pendingResult ? (
            <ConfirmationCard
              result={pendingResult}
              selectedDate={date}
              onCancel={() => setPendingResult(null)}
              onSaved={() => setPendingResult(null)}
            />
          ) : null}
        </div>
      </AuthGate>
    </AppShell>
  );
}
