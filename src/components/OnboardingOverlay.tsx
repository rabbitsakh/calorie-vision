"use client";

import { useCallback, useEffect, useState } from "react";
import { Mascot } from "@/components/Mascot";
import { setPwaOnboardingSeen } from "@/components/PwaInstallWizard";
import { withBasePath } from "@/lib/paths";

const STORAGE_KEY = "cv-onboarding-v1";

type Step = {
  title: string;
  body: string;
  pose: "tip" | "cheer" | "idle";
  cta: string;
};

const STEPS: Step[] = [
  {
    title: "Ваша цель рядом",
    body: "На рационе сверху — прогресс за день. Держите калории и белок в комфортной зоне.",
    pose: "tip",
    cta: "Дальше",
  },
  {
    title: "Первое фото",
    body: "Сфотографируйте тарелку или этикетку — распознаем блюдо и калории. Можно и текстом, если так удобнее.",
    pose: "cheer",
    cta: "Дальше",
  },
  {
    title: "Ярлык на экран «Домой»",
    body: "Добавьте Calorie Vision как приложение — быстрее открывается, удобнее напоминания. Подсказка есть в профиле.",
    pose: "idle",
    cta: "Готово",
  },
];

function isDone(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) === "1";
  } catch {
    return true;
  }
}

function markDone(): void {
  try {
    localStorage.setItem(STORAGE_KEY, "1");
  } catch {
    // ignore
  }
}

/** First-visit post-login tips on the ration page. */
export function OnboardingOverlay() {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(0);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!isDone()) setOpen(true);
  }, []);

  const finish = useCallback(() => {
    markDone();
    setPwaOnboardingSeen();
    setOpen(false);
  }, []);

  const next = useCallback(() => {
    if (step >= STEPS.length - 1) {
      finish();
      return;
    }
    setStep((value) => value + 1);
  }, [finish, step]);

  if (!open) return null;

  const current = STEPS[step] ?? STEPS[0];

  return (
    <div
      className="fixed inset-0 z-[80] flex items-end justify-center bg-slate-900/45 p-4 sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="cv-onboarding-title"
    >
      <div className="w-full max-w-md rounded-3xl border border-teal-100 bg-white p-5 shadow-xl sm:p-6">
        <div className="flex items-start gap-3">
          <Mascot pose={current.pose} size="md" className="shrink-0" />
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold uppercase tracking-wide text-teal-700">
              Шаг {step + 1} из {STEPS.length}
            </p>
            <h2 id="cv-onboarding-title" className="mt-1 text-lg font-bold text-slate-900">
              {current.title}
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-slate-600">{current.body}</p>
          </div>
        </div>

        <div className="mt-5 flex items-center justify-between gap-3">
          <button type="button" className="btn-quiet text-sm text-slate-500" onClick={finish}>
            Пропустить
          </button>
          <div className="flex items-center gap-2">
            {step === STEPS.length - 1 ? (
              <a href={withBasePath("/profile")} className="btn-quiet text-sm text-teal-800" onClick={finish}>
                В профиль
              </a>
            ) : null}
            <button type="button" className="btn btn-primary text-sm" onClick={next}>
              {current.cta}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
