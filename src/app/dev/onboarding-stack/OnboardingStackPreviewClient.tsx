"use client";

import { AppShell } from "@/components/AppShell";
import { OnboardingOverlay } from "@/components/OnboardingOverlay";

export function OnboardingStackPreviewClient() {
  return (
    <AppShell title="Рацион" description="Проверка шагов поверх меню" compact>
      <OnboardingOverlay forceOpen />
      <div className="space-y-3 p-1">
        <p className="text-sm text-slate-600">
          Карточка «Шаг 1 из 4» и кнопки должны быть над нижним меню, не под ним.
        </p>
        <div className="h-40 rounded-2xl bg-teal-50/80" />
        <div className="h-40 rounded-2xl bg-slate-100" />
        <div className="h-40 rounded-2xl bg-slate-100" />
      </div>
    </AppShell>
  );
}
