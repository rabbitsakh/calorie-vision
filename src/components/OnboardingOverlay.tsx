"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { Mascot } from "@/components/Mascot";
import { setPwaOnboardingSeen } from "@/components/PwaInstallWizard";
import {
  GOAL_OPTIONS,
  SEX_OPTIONS,
  recommendDiet,
  type Sex,
  type WeightGoal,
} from "@/lib/diet";
import { ensureQuietDefaultForNewUsers } from "@/lib/gamification-quiet";
import { markOpenCameraAfterOnboarding } from "@/lib/first-hour-trust";
import { trackOnboardingCompleteGoal, trackOnboardingPhotoCtaGoal } from "@/lib/metrika-funnel";
import { requestOpenFoodCamera } from "@/lib/open-food-camera";
import { withBasePath } from "@/lib/paths";
import { toDateKeyTz } from "@/lib/dates";

const STORAGE_KEY = "cv-onboarding-v1";

type StepId = "goal" | "params" | "photo";

const STEPS: Array<{ id: StepId; title: string; body: string; pose: "tip" | "cheer" | "idle" }> = [
  {
    id: "goal",
    title: "Какая цель?",
    body: "От этого зависит дневная норма. Позже можно поменять в профиле.",
    pose: "tip",
  },
  {
    id: "params",
    title: "Параметры и норма",
    body: "Пол, вес и возраст — сразу посчитаем калории на день.",
    pose: "tip",
  },
  {
    id: "photo",
    title: "Первое фото",
    body: "Сфотографируйте тарелку или этикетку. Рядом вилка или карта — точнее порция. Проверьте и сохраните.",
    pose: "cheer",
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

/** First-visit: цель → параметры с нормой → первое фото (3 экрана). */
export function OnboardingOverlay({ forceOpen = false }: { forceOpen?: boolean } = {}) {
  const [mounted, setMounted] = useState(false);
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(0);
  const [goal, setGoal] = useState<WeightGoal>("LOSE");
  const [sex, setSex] = useState<Sex>("FEMALE");
  const [weightKg, setWeightKg] = useState("70");
  const [age, setAge] = useState("30");
  const [saving, setSaving] = useState(false);

  const steps = STEPS;
  const birthYear = useMemo(() => {
    const a = Number(age);
    if (!Number.isFinite(a) || a < 14 || a > 90) return null;
    return new Date().getFullYear() - Math.round(a);
  }, [age]);
  const weightNum = Number(weightKg);
  const liveTarget = useMemo(() => {
    if (!Number.isFinite(weightNum) || weightNum < 30 || weightNum > 250) return null;
    return recommendDiet(weightNum, goal, "HEALTHY", sex, null, birthYear, "LIGHT");
  }, [weightNum, goal, sex, birthYear]);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (forceOpen || !isDone()) setOpen(true);
  }, [forceOpen]);

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

  const saveParams = useCallback(async () => {
    setSaving(true);
    try {
      await fetch(withBasePath("/api/profile"), {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          goal,
          goalPace: goal === "MAINTAIN" ? null : "HEALTHY",
        }),
      });
      await fetch(withBasePath("/api/account"), {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sex,
          birthYear,
          activityLevel: "LIGHT",
        }),
      });
      if (Number.isFinite(weightNum) && weightNum >= 30 && weightNum <= 250) {
        const today = toDateKeyTz(new Date());
        await fetch(withBasePath("/api/weights"), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ date: today, weightKg: weightNum, confirmReplace: true }),
        });
      }
    } catch {
      // non-critical — user can fix in profile
    } finally {
      setSaving(false);
    }
  }, [goal, sex, birthYear, weightNum]);

  const next = useCallback(async () => {
    const current = steps[step];
    if (current?.id === "params") {
      await saveParams();
    }
    if (step >= steps.length - 1) {
      finish();
      return;
    }
    setStep((value) => value + 1);
  }, [finish, saveParams, step, steps]);

  if (!open || !mounted || typeof document === "undefined") return null;

  const current = steps[step] ?? steps[0]!;
  const isPhoto = current.id === "photo";
  const isParams = current.id === "params";
  const isGoal = current.id === "goal";

  const overlay = (
    <div
      className="fixed inset-0 z-[80] flex items-end justify-center bg-[var(--accent-ink)]/45 p-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:items-center sm:pb-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="cv-onboarding-title"
    >
      <div className="w-full max-w-md rounded-3xl border border-[var(--border-quiet)] bg-[var(--panel-wash)] p-5 shadow-[0_12px_28px_rgba(13,115,119,0.12)] sm:p-6">
        <div className="flex items-start gap-3">
          <Mascot pose={current.pose} size="md" className="shrink-0" />
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold uppercase tracking-wide text-[var(--accent-ink)]">
              Шаг {step + 1} из {steps.length}
            </p>
            <h2
              id="cv-onboarding-title"
              className="font-display mt-1 text-lg font-semibold tracking-tight text-[var(--foreground)]"
            >
              {current.title}
            </h2>
            <p className="mt-2 text-[0.9375rem] leading-relaxed text-[var(--muted-strong)]">
              {current.body}
            </p>
          </div>
        </div>

        {isGoal ? (
          <div className="mt-4 flex flex-col gap-2">
            {GOAL_OPTIONS.map((opt) => {
              const on = goal === opt.value;
              return (
                <button
                  key={opt.value}
                  type="button"
                  className={`rounded-2xl border px-3 py-2.5 text-left transition-colors ${
                    on
                      ? "border-[var(--accent)] bg-[var(--accent-soft)]"
                      : "border-[var(--border-quiet)] bg-[var(--card)]"
                  }`}
                  aria-pressed={on}
                  onClick={() => setGoal(opt.value)}
                >
                  <span className="block text-[0.975rem] font-semibold text-[var(--foreground)]">
                    {opt.label}
                  </span>
                  <span className="block text-sm text-[var(--muted-strong)]">{opt.hint}</span>
                </button>
              );
            })}
          </div>
        ) : null}

        {isParams ? (
          <div className="mt-4 flex flex-col gap-3">
            <div className="flex flex-wrap gap-2">
              {SEX_OPTIONS.map((opt) => {
                const on = sex === opt.value;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    className={`min-h-10 rounded-full px-3.5 text-[0.9375rem] font-semibold ${
                      on
                        ? "bg-[var(--accent)] text-white"
                        : "bg-[var(--accent-soft)] text-[var(--accent-ink)]"
                    }`}
                    aria-pressed={on}
                    onClick={() => setSex(opt.value)}
                  >
                    {opt.label}
                  </button>
                );
              })}
            </div>
            <div className="grid grid-cols-2 gap-2">
              <label className="field">
                <span className="text-sm font-semibold text-[var(--muted-strong)]">Вес, кг</span>
                <input
                  inputMode="decimal"
                  className="mt-1 w-full rounded-xl border border-[var(--border-quiet)] bg-white px-3 py-2 text-base font-semibold"
                  value={weightKg}
                  onChange={(e) => setWeightKg(e.target.value)}
                  aria-label="Вес в килограммах"
                />
              </label>
              <label className="field">
                <span className="text-sm font-semibold text-[var(--muted-strong)]">Возраст</span>
                <input
                  inputMode="numeric"
                  className="mt-1 w-full rounded-xl border border-[var(--border-quiet)] bg-white px-3 py-2 text-base font-semibold"
                  value={age}
                  onChange={(e) => setAge(e.target.value)}
                  aria-label="Возраст"
                />
              </label>
            </div>
            {liveTarget ? (
              <p className="rounded-2xl bg-[var(--accent-soft)] px-3 py-2.5 text-[0.975rem] font-semibold text-[var(--accent-ink)]">
                Норма ≈ {liveTarget.calories} ккал · белок {liveTarget.protein} г
              </p>
            ) : (
              <p className="text-sm text-[var(--muted)]">Укажите вес 30–250 кг и возраст 14–90.</p>
            )}
          </div>
        ) : null}

        <div className="mt-5 flex items-center justify-between gap-3">
          <button type="button" className="btn-quiet text-sm text-[var(--muted)]" onClick={() => finish()}>
            Пропустить
          </button>
          <div className="flex flex-wrap items-center justify-end gap-2">
            {isPhoto ? (
              <>
                <button
                  type="button"
                  className="btn-quiet text-sm text-[var(--accent-ink)]"
                  onClick={() => finish()}
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
            ) : (
              <button
                type="button"
                className="btn btn-primary text-sm"
                disabled={saving || (isParams && !liveTarget)}
                onClick={() => void next()}
              >
                {saving ? "Сохраняем…" : "Дальше"}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );

  return createPortal(overlay, document.documentElement);
}
