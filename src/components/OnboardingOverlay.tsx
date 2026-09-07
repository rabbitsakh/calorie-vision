"use client";

import { useCallback, useEffect, useState } from "react";
import { Mascot } from "@/components/Mascot";
import { setPwaOnboardingSeen } from "@/components/PwaInstallWizard";
import { ALLERGEN_OPTIONS, type AllergenId } from "@/lib/allergens";
import { markOpenCameraAfterOnboarding } from "@/lib/first-hour-trust";
import { ensureQuietDefaultForNewUsers } from "@/lib/gamification-quiet";
import { trackOnboardingCompleteGoal, trackOnboardingPhotoCtaGoal } from "@/lib/metrika-funnel";
import { requestOpenFoodCamera } from "@/lib/open-food-camera";
import { withBasePath } from "@/lib/paths";

const STORAGE_KEY = "cv-onboarding-v1";

type StepId = "goal" | "allergens" | "photo" | "pwa";

const STEP_META: Array<{ id: StepId; title: string; body: string; pose: "tip" | "cheer" | "idle" }> = [
  {
    id: "goal",
    title: "Цель рядом",
    body: "На рационе сверху — прогресс за день. Норму можно уточнить в профиле за минуту.",
    pose: "tip",
  },
  {
    id: "allergens",
    title: "Мягкие аллергены",
    body: "Отметьте, что важно избегать — подскажем на подтверждении и в дневнике. Это не диагноз.",
    pose: "tip",
  },
  {
    id: "photo",
    title: "Первое фото",
    body: "Сфотографируйте тарелку или этикетку — проверьте порцию и сохраните. Так начинается доверие к дневнику.",
    pose: "cheer",
  },
  {
    id: "pwa",
    title: "Ярлык на «Домой»",
    body: "Добавьте приложение — быстрее открывается и удобнее напоминания. Можно позже в профиле.",
    pose: "idle",
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

async function saveAllergens(ids: AllergenId[]): Promise<void> {
  try {
    await fetch(withBasePath("/api/account"), {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ allergens: ids }),
    });
  } catch {
    // non-critical
  }
}

/** First-visit guided run: goal → allergens → photo CTA → optional PWA. */
export function OnboardingOverlay() {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(0);
  const [allergens, setAllergens] = useState<AllergenId[]>([]);
  const [savingAllergens, setSavingAllergens] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!isDone()) setOpen(true);
  }, []);

  const finish = useCallback((opts?: { openCamera?: boolean }) => {
    markDone();
    setPwaOnboardingSeen();
    ensureQuietDefaultForNewUsers();
    trackOnboardingCompleteGoal();
    setOpen(false);
    if (opts?.openCamera) {
      markOpenCameraAfterOnboarding();
      trackOnboardingPhotoCtaGoal();
      window.setTimeout(() => requestOpenFoodCamera(true), 420);
    }
  }, []);

  const next = useCallback(async () => {
    const current = STEP_META[step];
    if (current?.id === "allergens") {
      setSavingAllergens(true);
      await saveAllergens(allergens);
      setSavingAllergens(false);
    }
    if (step >= STEP_META.length - 1) {
      finish();
      return;
    }
    setStep((value) => value + 1);
  }, [allergens, finish, step]);

  if (!open) return null;

  const current = STEP_META[step] ?? STEP_META[0]!;
  const isPhoto = current.id === "photo";
  const isPwa = current.id === "pwa";

  function toggleAllergen(id: AllergenId) {
    setAllergens((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

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
              Шаг {step + 1} из {STEP_META.length}
            </p>
            <h2 id="cv-onboarding-title" className="mt-1 text-lg font-bold text-slate-900">
              {current.title}
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-slate-600">{current.body}</p>
          </div>
        </div>

        {current.id === "allergens" ? (
          <div className="mt-4 flex flex-wrap gap-2">
            {ALLERGEN_OPTIONS.map((opt) => {
              const on = allergens.includes(opt.id);
              return (
                <button
                  key={opt.id}
                  type="button"
                  className={`rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${
                    on
                      ? "bg-amber-700 text-white"
                      : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                  }`}
                  aria-pressed={on}
                  onClick={() => toggleAllergen(opt.id)}
                >
                  {opt.label}
                </button>
              );
            })}
          </div>
        ) : null}

        <div className="mt-5 flex items-center justify-between gap-3">
          <button type="button" className="btn-quiet text-sm text-slate-500" onClick={() => finish()}>
            Пропустить
          </button>
          <div className="flex flex-wrap items-center justify-end gap-2">
            {isPhoto ? (
              <>
                <button
                  type="button"
                  className="btn-quiet text-sm text-teal-800"
                  onClick={() => void next()}
                >
                  Позже
                </button>
                <button
                  type="button"
                  className="btn btn-primary text-sm"
                  onClick={() => finish({ openCamera: true })}
                >
                  Сфотографировать
                </button>
              </>
            ) : isPwa ? (
              <>
                <a
                  href={withBasePath("/profile")}
                  className="btn-quiet text-sm text-teal-800"
                  onClick={() => finish()}
                >
                  В профиль
                </a>
                <button
                  type="button"
                  className="btn btn-primary text-sm"
                  disabled={savingAllergens}
                  onClick={() => void next()}
                >
                  Готово
                </button>
              </>
            ) : (
              <button
                type="button"
                className="btn btn-primary text-sm"
                disabled={savingAllergens}
                onClick={() => void next()}
              >
                {savingAllergens ? "Сохраняем…" : "Дальше"}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
