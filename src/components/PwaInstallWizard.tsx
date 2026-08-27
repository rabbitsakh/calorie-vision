"use client";

import { useEffect, useMemo, useState } from "react";
import { isLikelyIos, isStandalonePwa } from "@/lib/push-client";

const WIZARD_DISMISS_KEY = "pwa-install-wizard-dismissed";
const ONBOARDING_SEEN_KEY = "pwa-install-onboarding-seen";

export type PwaInstallWizardProps = {
  open: boolean;
  onClose: () => void;
  prefer?: "ios" | "android" | "auto";
};

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

function MenuGlyph() {
  return (
    <svg className="inline h-4 w-4 align-text-bottom" viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="12" cy="5" r="1.5" fill="currentColor" />
      <circle cx="12" cy="12" r="1.5" fill="currentColor" />
      <circle cx="12" cy="19" r="1.5" fill="currentColor" />
    </svg>
  );
}

export function getPwaWizardDismissed(): boolean {
  try {
    return localStorage.getItem(WIZARD_DISMISS_KEY) === "1";
  } catch {
    return false;
  }
}

export function setPwaWizardDismissed(dismissed: boolean): void {
  try {
    if (dismissed) localStorage.setItem(WIZARD_DISMISS_KEY, "1");
    else localStorage.removeItem(WIZARD_DISMISS_KEY);
  } catch {
    // ignore
  }
}

export function getPwaOnboardingSeen(): boolean {
  try {
    return localStorage.getItem(ONBOARDING_SEEN_KEY) === "1";
  } catch {
    return true;
  }
}

export function setPwaOnboardingSeen(): void {
  try {
    localStorage.setItem(ONBOARDING_SEEN_KEY, "1");
  } catch {
    // ignore
  }
}

/** Modal with iOS + Android Home Screen install steps (#39). */
export function PwaInstallWizard({ open, onClose, prefer = "auto" }: PwaInstallWizardProps) {
  const detectedIos = useMemo(() => (typeof window !== "undefined" ? isLikelyIos() : false), []);
  const [tab, setTab] = useState<"ios" | "android">("ios");

  useEffect(() => {
    if (!open) return;
    if (prefer === "ios") setTab("ios");
    else if (prefer === "android") setTab("android");
    else setTab(detectedIos ? "ios" : "android");
  }, [open, prefer, detectedIos]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[80] flex items-end justify-center bg-slate-900/45 p-3 sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="pwa-wizard-title"
      onClick={onClose}
    >
      <div
        className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-2xl border border-slate-200 bg-white p-4 shadow-xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-2">
          <div>
            <p id="pwa-wizard-title" className="font-semibold text-slate-900">
              Установить на телефон
            </p>
            <p className="mt-1 text-sm text-slate-500">
              Ярлык на экране «Домой» — удобнее дневник и напоминания.
            </p>
          </div>
          <button type="button" className="btn-quiet text-sm text-slate-500" onClick={onClose}>
            Закрыть
          </button>
        </div>

        <div className="mt-3 grid grid-cols-2 gap-1 rounded-xl bg-slate-100 p-1">
          <button
            type="button"
            className={`rounded-lg px-3 py-2 text-sm font-medium ${
              tab === "ios" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500"
            }`}
            onClick={() => setTab("ios")}
          >
            iPhone
          </button>
          <button
            type="button"
            className={`rounded-lg px-3 py-2 text-sm font-medium ${
              tab === "android" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500"
            }`}
            onClick={() => setTab("android")}
          >
            Android
          </button>
        </div>

        {tab === "ios" ? (
          <ol className="mt-4 list-decimal space-y-2 pl-5 text-sm text-slate-700">
            <li>Откройте сайт в Safari.</li>
            <li>
              Нажмите «Поделиться» <ShareGlyph /> внизу экрана.
            </li>
            <li>Выберите «На экран „Домой“» → «Добавить».</li>
            <li>Запускайте с иконки — так работают уведомления (iOS 16.4+).</li>
          </ol>
        ) : (
          <ol className="mt-4 list-decimal space-y-2 pl-5 text-sm text-slate-700">
            <li>Откройте сайт в Chrome.</li>
            <li>
              Меню <MenuGlyph /> → «Установить приложение» или «На главный экран».
            </li>
            <li>Подтвердите установку.</li>
            <li>Открывайте с иконки — удобнее дневник и напоминания.</li>
          </ol>
        )}

        <button
          type="button"
          className="btn btn-primary mt-5 w-full"
          onClick={() => {
            setPwaWizardDismissed(true);
            setPwaOnboardingSeen();
            onClose();
          }}
        >
          Понятно
        </button>
      </div>
    </div>
  );
}

type SoftPromptProps = {
  onOpenWizard: () => void;
};

export function PwaInstallOnboardingPrompt({ onOpenWizard }: SoftPromptProps) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (isStandalonePwa()) return;
    if (getPwaOnboardingSeen() || getPwaWizardDismissed()) return;
    setVisible(true);
  }, []);

  if (!visible) return null;

  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
      <p className="font-semibold text-slate-800">Добавить на экран «Домой»</p>
      <p className="mt-1 text-sm text-slate-600">
        Установите Calorie Vision как приложение — быстрее вход и напоминания.
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          className="btn btn-on-tint text-sm text-slate-800"
          onClick={() => {
            setPwaOnboardingSeen();
            setVisible(false);
            onOpenWizard();
          }}
        >
          Как установить
        </button>
        <button
          type="button"
          className="btn-quiet text-sm text-slate-500"
          onClick={() => {
            setPwaOnboardingSeen();
            setVisible(false);
          }}
        >
          Позже
        </button>
      </div>
    </div>
  );
}
