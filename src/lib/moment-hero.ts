/**
 * «Сейчас главное» — one card at the top of the day that changes with the moment:
 * live gym → morning brief → daytime remaining → evening summary.
 * Pure: the component feeds diary + gym state, this decides what to say.
 */

import type { MorningTodayBrief } from "@/lib/morning-today";
import { dayPartFromHour } from "@/lib/splash-tips";

export type SoftStepAction = "weight" | "food" | "water" | "week";

export type SoftStep = {
  label: string;
  actionLabel: string;
  action: SoftStepAction;
};

export type SoftStepInput = {
  hour: number;
  logged: boolean;
  /** Calorie target exists (weight known). */
  hasTarget: boolean;
  protein: number;
  proteinTarget: number;
  waterMl: number;
  waterTarget: number;
  postWorkout: boolean;
  weekNudge: string | null;
  daysLoggedThisWeek: number;
  weekNudgeDismissed: boolean;
};

/** One soft follow-up (former NextStepBar). Never a second photo CTA. */
export function pickSoftStep(input: SoftStepInput): SoftStep | null {
  const { hour, logged } = input;
  if (logged && !input.hasTarget) {
    return {
      label: "Укажите вес — появится норма калорий",
      actionLabel: "Вес",
      action: "weight",
    };
  }

  const proteinLow = input.proteinTarget > 0 && input.protein < input.proteinTarget * 0.4;
  if (input.postWorkout && !logged) {
    return { label: "После тренировки — приём с белком", actionLabel: "Добавить", action: "food" };
  }
  if (
    input.postWorkout &&
    logged &&
    input.proteinTarget > 0 &&
    input.protein < input.proteinTarget * 0.7
  ) {
    return { label: "После тренировки — доберите белок", actionLabel: "Добавить", action: "food" };
  }

  if (hour >= 11 && input.waterTarget > 0 && input.waterMl < input.waterTarget * 0.35) {
    return {
      label: "Воды пока мало — один стакан уже поможет",
      actionLabel: "Вода",
      action: "water",
    };
  }
  if (logged && hour >= 14 && proteinLow) {
    return { label: "Белка маловато — можно добавить приём", actionLabel: "Добавить", action: "food" };
  }

  const weekNudge = input.weekNudge?.trim() || null;
  if (
    weekNudge &&
    input.daysLoggedThisWeek >= 3 &&
    input.daysLoggedThisWeek < 7 &&
    !logged &&
    !input.weekNudgeDismissed
  ) {
    return { label: weekNudge, actionLabel: "Записать", action: "week" };
  }

  if (logged && hour >= 19 && input.waterTarget > 0 && input.waterMl < input.waterTarget * 0.5) {
    return { label: "До вечера воды мало — один стакан", actionLabel: "Вода", action: "water" };
  }
  return null;
}

export type MomentPhase = "gym" | "morning" | "day" | "evening";

export type MomentCta =
  | { label: string; href: string; action?: undefined }
  | { label: string; action: SoftStepAction; href?: undefined };

export type MomentHero = {
  phase: MomentPhase;
  eyebrow: string;
  title: string;
  /** Short facts line (macros / water / gym). */
  line: string | null;
  /** Soft follow-up under the facts. */
  hint: string | null;
  cta: MomentCta | null;
};

export type MomentHeroInput = {
  selectedIsToday: boolean;
  hour: number;
  gymLive: boolean;
  gymLiveLabel: string | null;
  gymDoneToday: boolean;
  morning: MorningTodayBrief | null;
  logged: boolean;
  calories: number;
  calorieTarget: number | null;
  protein: number;
  proteinTarget: number | null;
  waterMl: number;
  waterTarget: number;
  streak: number;
  softStep: SoftStep | null;
};

function formatLiters(ml: number): string {
  const l = Math.round(ml / 100) / 10;
  return l.toLocaleString("ru-RU", { maximumFractionDigits: 1 });
}

function waterPart(input: MomentHeroInput): string | null {
  if (!(input.waterTarget > 0)) return null;
  return `вода ${formatLiters(input.waterMl)} из ${formatLiters(input.waterTarget)} л`;
}

function softCta(step: SoftStep | null): MomentCta | null {
  return step ? { label: step.actionLabel, action: step.action } : null;
}

export function buildMomentHero(input: MomentHeroInput): MomentHero | null {
  if (!input.selectedIsToday) return null;

  if (input.gymLive) {
    return {
      phase: "gym",
      eyebrow: "Сейчас · зал",
      title: "Тренировка идёт",
      line: input.gymLiveLabel?.trim() || "Вернитесь к текущему подходу",
      hint: "Напоминания о еде и воде на паузе",
      cta: { label: "К подходам", href: "/workouts" },
    };
  }

  const part = dayPartFromHour(input.hour);

  if (part === "morning") {
    if (!input.morning) return null;
    return {
      phase: "morning",
      eyebrow: "Утро · что сегодня",
      title: input.morning.line,
      line: waterPart(input),
      hint: null,
      cta: input.morning.cta
        ? { label: input.morning.cta.label, href: input.morning.cta.href }
        : softCta(input.softStep),
    };
  }

  const isEvening = part === "evening" || part === "night";

  if (!input.logged) {
    return {
      phase: isEvening ? "evening" : "day",
      eyebrow: isEvening ? "Вечер" : "День",
      title: "День пока без записей",
      line: "Одна запись — и день открыт",
      hint: null,
      cta: { label: "Добавить", action: "food" },
    };
  }

  const pt = input.proteinTarget ?? 0;

  if (isEvening) {
    const kcal = Math.round(input.calories);
    const title =
      input.calorieTarget && input.calorieTarget > 0
        ? `${kcal} из ${Math.round(input.calorieTarget)} ккал`
        : `${kcal} ккал за день`;
    const parts = [
      pt > 0 ? `белок ${Math.round(input.protein)}/${Math.round(pt)} г` : null,
      waterPart(input),
      input.gymDoneToday ? "зал ✓" : null,
      input.streak >= 2 ? `серия ${input.streak} дн.` : null,
    ].filter((p): p is string => Boolean(p));
    return {
      phase: "evening",
      eyebrow: "Вечер · итог дня",
      title,
      line: parts.length ? parts.join(" · ") : null,
      hint: input.softStep?.label ?? null,
      cta: softCta(input.softStep),
    };
  }

  let title: string;
  if (input.calorieTarget && input.calorieTarget > 0) {
    const left = Math.round(input.calorieTarget - input.calories);
    title =
      left > 50
        ? `Осталось ~${left} ккал`
        : left >= -50
          ? "Калории в норме"
          : `+${Math.abs(left)} ккал сверх цели`;
  } else {
    title = `${Math.round(input.calories)} ккал сегодня`;
  }
  const proteinLeft = pt > 0 ? Math.round(pt - input.protein) : 0;
  const parts = [
    proteinLeft > 5 ? `белок: ещё ${proteinLeft} г` : pt > 0 ? "белок ✓" : null,
    waterPart(input),
    input.gymDoneToday ? "зал ✓" : null,
  ].filter((p): p is string => Boolean(p));

  return {
    phase: "day",
    eyebrow: "День · сейчас главное",
    title,
    line: parts.length ? parts.join(" · ") : null,
    hint: input.softStep?.label ?? null,
    cta: softCta(input.softStep) ?? { label: "Добавить", action: "food" },
  };
}
