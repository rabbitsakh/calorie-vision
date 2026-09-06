"use client";

import { useState } from "react";
import { PwaInstallWizard } from "@/components/PwaInstallWizard";

function ShareGlyph() {
  return (
    <svg className="inline h-4 w-4 align-text-bottom" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M12 3v10M8 7l4-4 4 4M5 14v5a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-5"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function InstallPageClient() {
  const [wizardOpen, setWizardOpen] = useState(false);

  return (
    <>
      <div className="grid gap-3">
        <article className="rounded-2xl border border-slate-200 bg-white p-4">
          <h2 className="font-semibold text-slate-900">
            <ShareGlyph /> iPhone · Safari
          </h2>
          <ol className="mt-2 list-decimal space-y-1.5 pl-5 text-sm text-slate-700">
            <li>Откройте сайт в Safari.</li>
            <li>
              Нажмите «Поделиться» <ShareGlyph /> внизу экрана.
            </li>
            <li>«На экран „Домой“» → «Добавить».</li>
            <li>Открывайте приложение только с новой иконки.</li>
          </ol>
        </article>

        <article className="rounded-2xl border border-slate-200 bg-white p-4">
          <h2 className="font-semibold text-slate-900">Android · Chrome</h2>
          <ol className="mt-2 list-decimal space-y-1.5 pl-5 text-sm text-slate-700">
            <li>Откройте сайт в Chrome.</li>
            <li>Меню ⋮ → «Установить приложение» или «Добавить на главный экран».</li>
            <li>Подтвердите установку.</li>
          </ol>
        </article>
      </div>

      <button type="button" className="btn btn-primary w-full" onClick={() => setWizardOpen(true)}>
        Пошаговая установка
      </button>

      <PwaInstallWizard open={wizardOpen} onClose={() => setWizardOpen(false)} prefer="auto" />
    </>
  );
}
