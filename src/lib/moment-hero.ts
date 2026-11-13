/**
 * «Сейчас главное» — one card at the top of the day that changes with the moment:
 * live gym → morning brief → daytime remaining → evening summary.
 * Pure: the component feeds diary + gym state, this decides what to say.
 */

import type { MorningTodayBrief } from "@/lib/morning-today";
import type { ReadyChestSource } from "@/lib/chest-ready-queue";
import { isComboDay } from "@/lib/gym-rewards";
import { QUEST_DAYS_PER_CHEST } from "@/lib/rewards";
import { dayPartFromHour } from "@/lib/splash-tips";
import { formatWaterOf } from "@/lib/water-display";

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
  | { label: string; href: string; action?: undefined; disabled?: undefined }
  | { label: string; action: SoftStepAction; href?: undefined; disabled?: undefined }
  | { label: string; disabled: true; action?: undefined; href?: undefined };

export type MomentMascot = "cheer" | "tip" | "streak" | "goal" | "idle";

export type MomentMacro = { key: "protein" | "fat" | "carbs"; label: string; value: number; target: number };

/** Day card: water and gym as their own rows, not glued into the protein sentence. */
export type MomentChip = {
  kind: "water" | "gym";
  title: string;
  detail: string;
  actionLabel: string;
};

export type MomentKcal = { eaten: number; target: number };

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
  /** One line under the evening checklist. */
  checklistNote: string | null;
  /** Eaten and target for the day scale. Null outside the logged day card. */
  kcal: MomentKcal | null;
  /** One protein sentence. Not repeated in hint. */
  proteinNote: string | null;
  /** Water and gym rows on the day card. */
  chips: MomentChip[] | null;
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
  /** Evening chest meter. Null while /api/rewards has not loaded. */
  chest?: EveningChestSnapshot | null;
};

export const CHEST_CHECKLIST_NOTE =
  "Еда и вода — один зачёт. Тренировка с подходами — ещё один, один раз за день.";

export type EveningChestHead = {
  source: ReadyChestSource;
  detail: string;
  label?: string;
  milestone?: number;
};

/** Server meter for the evening hero. `todayMarked` is the quest-day row for today. */
export type EveningChestSnapshot = {
  state: "empty" | "filling" | "ready";
  questDayCount: number;
  openedQuestChests: number;
  todayMarked: boolean;
  per?: number;
  head: EveningChestHead | null;
};

/** Water counts for the chest only at 100% of the personal target. */
export function waterMeetsChest(waterMl: number, waterTarget: number): boolean {
  return waterTarget > 0 && waterMl >= waterTarget;
}

/**
 * Liters for the checklist. Below the target, floor to 0.1 л so 1.99 л
 * never renders as the same number as the goal.
 */
export function formatWaterProgress(ml: number, target: number): string {
  return formatWaterOf(ml, target);
}

function recordedPctTitle(calories: number, calorieTarget: number | null): string {
  if (!calorieTarget || calorieTarget <= 0) {
    return `${formatKcal(calories)} ккал за день`;
  }
  const pct = Math.round((calories / calorieTarget) * 100);
  return `Записано ${pct}% цели`;
}

function calmDaysLeftLabel(count: number): string {
  const mod10 = count % 10;
  const mod100 = count % 100;
  let word = "спокойных дней";
  if (!(mod100 >= 11 && mod100 <= 14)) {
    if (mod10 === 1) word = "спокойный день";
    else if (mod10 >= 2 && mod10 <= 4) word = "спокойных дня";
  }
  return `Ещё ${count} ${word} до сундука`;
}

function sourceChestTitle(head: EveningChestHead): string {
  if (head.source === "streak") {
    return head.milestone ? `Сундук за серию ${head.milestone}` : "Сундук за серию";
  }
  if (head.source === "week") return "Сундук за спокойную неделю";
  if (head.source === "challenge") return "Сундук за челлендж";
  if (head.source === "referral") return "Сундук за приглашение";
  return "Сундук готов";
}

function sourceChestCaption(head: EveningChestHead): string {
  if (head.source === "streak") return "Серия дней";
  if (head.source === "week") return "Спокойная неделя";
  if (head.source === "challenge") return head.label?.trim() || "Недельный челлендж";
  if (head.source === "referral") return "Приглашение друга";
  return head.detail;
}

type EveningResolution = {
  title: string;
  cta: MomentCta;
  /** Replaces the soft hint when the chest source must be named. */
  sourceHint: string | null;
};

/**
 * Evening/night hero copy. Opening is offered only when the server meter is ready.
 */
export function resolveEveningDay(input: {
  logged: boolean;
  waterMl: number;
  waterTarget: number;
  calories: number;
  calorieTarget: number | null;
  chest?: EveningChestSnapshot | null;
}): EveningResolution {
  const chest = input.chest ?? null;
  const ready = chest?.state === "ready";
  const head = ready ? chest?.head ?? null : null;

  if (ready && head && head.source !== "quest") {
    return {
      title: sourceChestTitle(head),
      cta: { label: "Открыть сундук", action: "chest" },
      sourceHint: sourceChestCaption(head),
    };
  }
  if (ready) {
    return {
      title: "Сундук готов",
      cta: { label: "Открыть сундук", action: "chest" },
      sourceHint: null,
    };
  }

  const waterOk = waterMeetsChest(input.waterMl, input.waterTarget);
  if (!input.logged && input.waterMl > 0) {
    return {
      title: recordedPctTitle(input.calories, input.calorieTarget),
      cta: { label: "Записать еду", action: "food" },
      sourceHint: null,
    };
  }
  if (!input.logged) {
    return {
      title: "День пока без записей",
      cta: { label: "Сфоткать еду", action: "camera" },
      sourceHint: null,
    };
  }
  if (!waterOk) {
    return {
      title: recordedPctTitle(input.calories, input.calorieTarget),
      cta: { label: "Долить воду до нормы", action: "water" },
      sourceHint: null,
    };
  }

  if (!chest) {
    return {
      title: "День засчитан",
      cta: { label: "Ещё спокойные дни до сундука", disabled: true },
      sourceHint: null,
    };
  }

  const per = Math.max(1, chest.per ?? QUEST_DAYS_PER_CHEST);
  const markedDays = Math.max(0, Math.floor(chest.questDayCount) || 0);
  const opened = Math.max(0, Math.floor(chest.openedQuestChests) || 0);
  const projected = markedDays + (chest.todayMarked ? 0 : 1);
  const pending = Math.max(0, Math.floor(projected / per) - opened);
  const remainder = projected % per;

  if (!chest.todayMarked && pending > 0) {
    return {
      title: "Сундук готов",
      cta: { label: "Открыть сундук", disabled: true },
      sourceHint: null,
    };
  }

  if (chest.todayMarked && markedDays > 0 && markedDays % per === 0 && pending === 0) {
    return {
      title: "День засчитан",
      cta: { label: "Сундук уже открыт", href: "/profile#rewards" },
      sourceHint: null,
    };
  }

  const nextIn = remainder === 0 ? per : per - remainder;
  return {
    title: "День засчитан",
    cta: { label: calmDaysLeftLabel(nextIn), disabled: true },
    sourceHint: null,
  };
}

function formatKcal(n: number): string {
  return Math.round(n).toLocaleString("ru-RU");
}

function waterPart(input: MomentHeroInput): string | null {
  if (!(input.waterTarget > 0)) return null;
  return `вода ${formatWaterOf(input.waterMl, input.waterTarget)}`;
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
  push("protein", "Белки", input.protein, input.proteinTarget);
  push("fat", "Жиры", input.fat, input.fatTarget);
  push("carbs", "Углеводы", input.carbs, input.carbsTarget);
  return rows.length ? rows : null;
}

const PROTEIN_HINTS = new Set([
  "После тренировки — доберите белок",
  "После тренировки — приём с белком",
]);

const EMPTY_EXTRAS = {
  macros: null,
  ringPct: null,
  checklist: null,
  checklistNote: null,
  kcal: null,
  proteinNote: null,
  chips: null,
} as const;

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

  if (isEvening) {
    return buildEveningHero(input);
  }

  if (!input.logged) {
    return {
      phase: part === "morning" ? "morning" : "day",
      tone: "soft",
      mascot: "idle",
      eyebrow: part === "morning" ? "Сейчас · утро" : dayEyebrow(input.hour),
      title: "День пока без записей",
      line: input.calorieTarget ? `цель ${formatKcal(input.calorieTarget)} ккал` : "Одна запись — и день открыт",
      hint: null,
      // Camera-first — matches bottom composer; avoids a second «добавить» that fights the dock.
      cta: { label: "Сфоткать еду", action: "camera" },
      ...EMPTY_EXTRAS,
    };
  }

  const pt = input.proteinTarget ?? 0;

  const target = input.calorieTarget && input.calorieTarget > 0 ? input.calorieTarget : null;
  let title: string;
  let left = 0;
  if (target) {
    left = Math.round(target - input.calories);
    title =
      left > 50
        ? `Осталось ${formatKcal(left)} из ${formatKcal(target)} ккал`
        : left >= -50
          ? "Калории в норме"
          : `+${formatKcal(Math.abs(left))} ккал сверх цели`;
  } else {
    title = `${formatKcal(input.calories)} ккал сегодня`;
  }
  const proteinLeft = pt > 0 ? Math.round(pt - input.protein) : 0;
  const combo = isComboDay({
    qualifyingWorkout: input.gymDoneToday,
    protein: input.protein,
    proteinTarget: pt,
  });
  const proteinNote =
    !combo && input.gymDoneToday && proteinLeft > 5
      ? `После зала ещё ${formatKcal(proteinLeft)} г белка`
      : null;
  const water = input.waterTarget > 0 ? waterDetail(input) : null;
  const chips: MomentChip[] = [];
  if (water) {
    chips.push({ kind: "water", title: "Вода", detail: water, actionLabel: "Стакан" });
  }
  if (input.gymDoneToday) {
    chips.push({ kind: "gym", title: "Зал", detail: "сегодня сделан", actionLabel: "Открыть" });
  }
  const soft = input.softStep;
  const proteinRepeated = proteinNote != null && soft != null && PROTEIN_HINTS.has(soft.label);

  return {
    phase: "day",
    tone: "soft",
    mascot: "tip",
    eyebrow: part === "morning" ? "Сейчас · утро" : dayEyebrow(input.hour),
    title,
    line: combo ? "комбо-день · тренировка и белок" : null,
    hint: proteinRepeated ? null : soft?.label ?? null,
    cta: proteinRepeated
      ? { label: "Добавить еду", action: "food" }
      : softCta(soft) ?? { label: "Добавить еду", action: "food" },
    macros: macroBars(input),
    ringPct: null,
    checklist: null,
    checklistNote: null,
    kcal: target ? { eaten: Math.round(input.calories), target: Math.round(target) } : null,
    proteinNote,
    chips: chips.length ? chips : null,
  };
}

function waterDetail(input: MomentHeroInput): string | null {
  if (!(input.waterTarget > 0)) return null;
  return formatWaterOf(input.waterMl, input.waterTarget);
}

function buildEveningChecklist(input: MomentHeroInput): MomentCheck[] {
  const pt = input.proteinTarget ?? 0;
  const mealCount = input.mealCount ?? 0;
  const checklist: MomentCheck[] = [
    {
      label: "Еда",
      done: input.logged && mealCount > 0,
      value: mealCount > 0 ? `${mealCount} ${mealWord(mealCount)} записано` : "пока пусто",
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
      done: waterMeetsChest(input.waterMl, input.waterTarget),
      value: formatWaterProgress(input.waterMl, input.waterTarget),
    });
  }
  const combo = isComboDay({
    qualifyingWorkout: input.gymDoneToday,
    protein: input.protein,
    proteinTarget: pt,
  });
  checklist.push({
    label: "Зал",
    done: input.gymDoneToday,
    value: combo ? "комбо-день" : input.gymDoneToday ? "сделан" : "сегодня без зала",
  });
  return checklist;
}

function buildEveningHero(input: MomentHeroInput): MomentHero {
  const kcal = Math.round(input.calories);
  const target = input.calorieTarget && input.calorieTarget > 0 ? input.calorieTarget : null;
  const pct = target ? Math.round((kcal / target) * 100) : null;
  const resolved = resolveEveningDay({
    logged: input.logged,
    waterMl: input.waterMl,
    waterTarget: input.waterTarget,
    calories: input.calories,
    calorieTarget: input.calorieTarget,
    chest: input.chest,
  });
  const tomorrow = input.tomorrowPlanLabel?.trim() || null;
  const softHint = resolved.sourceHint ? null : input.softStep?.label ?? null;
  const hintParts = [
    resolved.sourceHint,
    softHint,
    tomorrow ? `Завтра: ${tomorrow}` : null,
  ].filter((part): part is string => Boolean(part));
  const empty = !input.logged && input.waterMl <= 0;
  return {
    phase: "evening",
    tone: empty ? "soft" : "dark",
    mascot: empty ? "idle" : "streak",
    eyebrow: empty ? (input.hour >= 5 && input.hour < 11 ? "Сейчас · утро" : "Сейчас · вечер") : "Итог дня",
    title: resolved.title,
    line: empty
      ? target
        ? `цель ${formatKcal(target)} ккал`
        : "Одна запись — и день открыт"
      : target
        ? `${formatKcal(kcal)} из ${formatKcal(target)} ккал${input.streak >= 2 ? ` · серия ${input.streak} дн.` : ""}`
        : input.streak >= 2
          ? `серия ${input.streak} дн.`
          : null,
    hint: hintParts.join(" · ") || null,
    cta: resolved.cta,
    macros: null,
    ringPct: empty ? null : pct,
    checklist: empty ? null : buildEveningChecklist(input),
    checklistNote: empty ? null : CHEST_CHECKLIST_NOTE,
    kcal: null,
    proteinNote: null,
    chips: null,
  };
}
