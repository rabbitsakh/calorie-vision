/**
 * «Сейчас главное» — one card at the top of the day that changes with the moment:
 * live gym → morning brief → daytime remaining → evening summary.
 * Pure: the component feeds diary + gym state, this decides what to say.
 */

import type { MorningTodayBrief } from "@/lib/morning-today";
import { dayPartFromHour } from "@/lib/splash-tips";

export type SoftStepAction = "weight" | "food" | "water" | "week" | "camera" | "chest";

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

export type MomentMascot = "cheer" | "tip" | "streak" | "goal" | "idle";

export type MomentMacro = { key: "protein" | "fat" | "carbs"; label: string; value: number; target: number };

export type MomentCheck = { label: string; done: boolean; value: string };

export type MomentHero = {
  phase: MomentPhase;
  /** dark = filled teal hero (gym / morning plan / evening); soft = white card. */
  tone: "dark" | "soft";
  mascot: MomentMascot;
  eyebrow: string;
  title: string;
  /** Short facts line (exercises / kcal of target / gym). */
  line: string | null;
  /** Soft follow-up under the facts. */
  hint: string | null;
  /** Big full-width button (white on dark, accent on soft). */
  cta: MomentCta | null;
  /** Daytime Б/Ж/У bars. */
  macros: MomentMacro[] | null;
  /** Evening ring, 0–100+. */
  ringPct: number | null;
  /** Evening checklist under the hero. */
  checklist: MomentCheck[] | null;
};

export type MomentRoutine = {
  name: string;
  exerciseCount: number;
  /** e.g. «Жим · цель 80 кг (+2.5)» from last session / plan label. */
  goalHint?: string | null;
};

export type MomentHeroInput = {
  selectedIsToday: boolean;
  hour: number;
  gymLive: boolean;
  gymLiveLabel: string | null;
  gymDoneToday: boolean;
  morning: MorningTodayBrief | null;
  /** First routine planned for today (morning hero shows it big). */
  routine?: MomentRoutine | null;
  /** Tomorrow’s plan label for evening wrap-up. */
  tomorrowPlanLabel?: string | null;
  logged: boolean;
  mealCount?: number;
  calories: number;
  calorieTarget: number | null;
  protein: number;
  proteinTarget: number | null;
  fat?: number;
  fatTarget?: number | null;
  carbs?: number;
  carbsTarget?: number | null;
  waterMl: number;
  waterTarget: number;
  streak: number;
  softStep: SoftStep | null;
};

function formatLiters(ml: number): string {
  const l = Math.round(ml / 100) / 10;
  return l.toLocaleString("ru-RU", { maximumFractionDigits: 1 });
}

function formatKcal(n: number): string {
  return Math.round(n).toLocaleString("ru-RU");
}

function waterPart(input: MomentHeroInput): string | null {
  if (!(input.waterTarget > 0)) return null;
  return `вода ${formatLiters(input.waterMl)} из ${formatLiters(input.waterTarget)} л`;
}

function softCta(step: SoftStep | null): MomentCta | null {
  return step ? { label: step.actionLabel, action: step.action } : null;
}

function mealWord(n: number): string {
  const n10 = n % 10;
  const n100 = n % 100;
  if (n10 === 1 && n100 !== 11) return "приём";
  if (n10 >= 2 && n10 <= 4 && (n100 < 12 || n100 > 14)) return "приёма";
  return "приёмов";
}

function exerciseWord(n: number): string {
  const n10 = n % 10;
  const n100 = n % 100;
  if (n10 === 1 && n100 !== 11) return "упражнение";
  if (n10 >= 2 && n10 <= 4 && (n100 < 12 || n100 > 14)) return "упражнения";
  return "упражнений";
}

/** «Сейчас · обед» by hour. */
function dayEyebrow(hour: number): string {
  if (hour >= 11 && hour < 15) return "Сейчас · обед";
  if (hour >= 15 && hour < 18) return "Сейчас · день";
  return "Сейчас · вечер";
}

function macroBars(input: MomentHeroInput): MomentMacro[] | null {
  const rows: MomentMacro[] = [];
  const push = (key: MomentMacro["key"], label: string, value?: number, target?: number | null) => {
    if (target && target > 0) rows.push({ key, label, value: Math.round(value ?? 0), target: Math.round(target) });
  };
  push("protein", "Б", input.protein, input.proteinTarget);
  push("fat", "Ж", input.fat, input.fatTarget);
  push("carbs", "У", input.carbs, input.carbsTarget);
  return rows.length ? rows : null;
}

const EMPTY_EXTRAS = { macros: null, ringPct: null, checklist: null } as const;

export function buildMomentHero(input: MomentHeroInput): MomentHero | null {
  if (!input.selectedIsToday) return null;

  if (input.gymLive) {
    return {
      phase: "gym",
      tone: "dark",
      mascot: "cheer",
      eyebrow: "Сейчас · зал",
      title: "Тренировка идёт",
      line: input.gymLiveLabel?.trim() || "Вернитесь к текущему подходу",
      hint: "Напоминания о еде и воде на паузе",
      cta: { label: "К подходам", href: "/workouts" },
      ...EMPTY_EXTRAS,
    };
  }

  const part = dayPartFromHour(input.hour);

  if (part === "morning" && input.morning) {
    const routine = input.routine && !input.gymDoneToday ? input.routine : null;
    if (routine) {
      const n = routine.exerciseCount;
      const minutes = n > 0 ? Math.max(20, Math.round((n * 11) / 5) * 5) : 0;
      const facts = [
        n > 0 ? `${n} ${exerciseWord(n)} · ~${minutes} мин` : null,
        routine.goalHint?.trim() || null,
      ].filter((p): p is string => Boolean(p));
      return {
        phase: "morning",
        tone: "dark",
        mascot: "cheer",
        eyebrow: "Сейчас · утро",
        title: routine.name,
        line: facts.length ? facts.join(" · ") : null,
        hint: input.logged ? null : "Первый приём — и день начат",
        cta: { label: "Начать тренировку", href: "/workouts" },
        ...EMPTY_EXTRAS,
      };
    }
    return {
      phase: "morning",
      tone: "dark",
      mascot: "cheer",
      eyebrow: "Сейчас · утро",
      title: input.morning.line,
      line: waterPart(input),
      hint: null,
      cta: input.morning.cta
        ? { label: input.morning.cta.label, href: input.morning.cta.href }
        : softCta(input.softStep),
      ...EMPTY_EXTRAS,
    };
  }

  const isEvening = part === "evening" || part === "night";

  if (!input.logged) {
    return {
      phase: isEvening ? "evening" : part === "morning" ? "morning" : "day",
      tone: "soft",
      mascot: "idle",
      eyebrow: isEvening ? "Сейчас · вечер" : part === "morning" ? "Сейчас · утро" : dayEyebrow(input.hour),
      title: "День пока без записей",
      line: input.calorieTarget ? `цель ${formatKcal(input.calorieTarget)} ккал` : "Одна запись — и день открыт",
      hint: null,
      // Camera-first — matches bottom composer; avoids a second «добавить» that fights the dock.
      cta: { label: "Сфоткать еду", action: "camera" },
      ...EMPTY_EXTRAS,
    };
  }

  const pt = input.proteinTarget ?? 0;

  if (isEvening) {
    const kcal = Math.round(input.calories);
    const target = input.calorieTarget && input.calorieTarget > 0 ? input.calorieTarget : null;
    const pct = target ? Math.round((kcal / target) * 100) : null;
    const title =
      pct == null
        ? `${formatKcal(kcal)} ккал за день`
        : pct >= 90 && pct <= 108
          ? "День в цели"
          : pct > 108
            ? "Чуть выше цели"
            : "День почти собран";
    const checklist: MomentCheck[] = [
      {
        label: "Еда",
        done: (input.mealCount ?? 0) > 0,
        value: input.mealCount ? `${input.mealCount} ${mealWord(input.mealCount)} записано` : "пока пусто",
      },
    ];
    if (pt > 0) {
      checklist.push({
        label: "Белок",
        done: input.protein >= pt * 0.9,
        value: `${Math.round(input.protein)} / ${Math.round(pt)} г`,
      });
    }
    if (input.waterTarget > 0) {
      checklist.push({
        label: "Вода",
        done: input.waterMl >= input.waterTarget * 0.9,
        value: `${formatLiters(input.waterMl)} / ${formatLiters(input.waterTarget)} л`,
      });
    }
    checklist.push({ label: "Зал", done: input.gymDoneToday, value: input.gymDoneToday ? "сделан" : "сегодня без зала" });
    const tomorrow = input.tomorrowPlanLabel?.trim() || null;
    const softHint = input.softStep?.label ?? null;
    return {
      phase: "evening",
      tone: "dark",
      mascot: "streak",
      eyebrow: "Итог дня",
      title,
      line: target
        ? `${formatKcal(kcal)} из ${formatKcal(target)} ккал${input.streak >= 2 ? ` · серия ${input.streak} дн.` : ""}`
        : input.streak >= 2
          ? `серия ${input.streak} дн.`
          : null,
      hint: [softHint, tomorrow ? `Завтра: ${tomorrow}` : null].filter(Boolean).join(" · ") || null,
      cta: { label: "Закрыть день · открыть сундук", action: "chest" },
      macros: null,
      ringPct: pct,
      checklist,
    };
  }

  let title: string;
  if (input.calorieTarget && input.calorieTarget > 0) {
    const left = Math.round(input.calorieTarget - input.calories);
    title =
      left > 50
        ? `Осталось ${formatKcal(left)} ккал`
        : left >= -50
          ? "Калории в норме"
          : `+${formatKcal(Math.abs(left))} ккал сверх цели`;
  } else {
    title = `${formatKcal(input.calories)} ккал сегодня`;
  }
  const proteinLeft = pt > 0 ? Math.round(pt - input.protein) : 0;
  const parts = [
    input.gymDoneToday && proteinLeft > 5 ? `после зала добери ~${proteinLeft} г белка` : null,
    waterPart(input),
    input.gymDoneToday ? "зал ✓" : null,
  ].filter((p): p is string => Boolean(p));

  return {
    phase: "day",
    tone: "soft",
    mascot: "tip",
    eyebrow: part === "morning" ? "Сейчас · утро" : dayEyebrow(input.hour),
    title,
    line: parts.length ? parts.join(" · ") : null,
    hint: input.softStep?.label ?? null,
    cta: softCta(input.softStep) ?? { label: "Добавить еду", action: "food" },
    macros: macroBars(input),
    ringPct: null,
    checklist: null,
  };
}
