/**
 * G3 — pick exactly one progression lever for the post-session tip.
 * Preference (remembered / primary) wins; AI may only phrase that lever.
 * K1 — 2× miss nudges soft deload / switch.
 */

import type { ProgressionLever, ProgressionOption } from "@/lib/workouts/progression";
import { getLeverMissStreak } from "@/lib/workouts/lever-outcome-history";
import { getLeverMemory } from "@/lib/workouts/progression-lever-memory";

export type TipTarget = {
  name: string;
  adviceKind: "progress" | "hold" | "stall" | "deload" | "base";
  line: string;
  primaryLever: ProgressionLever | null;
  leverRemembered?: boolean;
  options: ProgressionOption[];
};

export type TipLeverPick = {
  exerciseName: string;
  lever: ProgressionLever;
  label: string;
  line: string;
  fromPreference: boolean;
  adviceKind: TipTarget["adviceKind"];
  options: ProgressionOption[];
  /** Consecutive misses on current lever (K1). */
  missStreak: number;
};

// Avoid \\b — JS word boundaries ignore Cyrillic letters.
const LEVER_WORDS: Record<ProgressionLever, RegExp> = {
  weight: /(вес|кг|deload)/i,
  volume: /(тоннаж|подход|объ[её]м)/i,
  reps: /(повтор|×|x\s*\d)/i,
};

function toPick(focus: TipTarget): TipLeverPick | null {
  const lever = focus.primaryLever ?? focus.options[0]?.lever ?? null;
  if (!lever) return null;
  const opt =
    focus.options.find((o) => o.lever === lever) ?? focus.options[0] ?? null;
  return {
    exerciseName: focus.name,
    lever,
    label: opt?.label ?? lever,
    line: opt?.line ?? focus.line,
    fromPreference: Boolean(focus.leverRemembered),
    adviceKind: focus.adviceKind,
    options: focus.options,
    missStreak: getLeverMissStreak(focus.name),
  };
}

/** Choose one exercise+lever for the tip. Prefers 2× miss (K1), then remembered, then primary. */
export function pickTipFocus(targets: readonly TipTarget[]): TipLeverPick | null {
  if (targets.length === 0) return null;

  const withOptions = targets.filter((t) => t.options.length > 0);
  const pool = withOptions.length > 0 ? withOptions : [...targets];

  const struggling = pool.find(
    (t) => t.primaryLever && getLeverMissStreak(t.name) >= 2,
  );
  if (struggling) return toPick(struggling);

  const remembered = pool.find((t) => t.leverRemembered && t.primaryLever);
  const focus = remembered ?? pool[0]!;
  return toPick(focus);
}

/** Rule one-liner locked to the picked lever (no multi-lever advice). */
export function ruleTipForFocus(
  pick: TipLeverPick,
  opts?: { recoveryHit?: boolean; earlyUser?: boolean },
): string {
  const name = pick.exerciseName;
  const early = Boolean(opts?.earlyUser);
  // O: celebrate recovery hit before miss/stall nudges.
  if (opts?.recoveryHit) {
    return early
      ? `Восстановление сработало на «${name}» — оставляем цель: ${pick.line}.`
      : `Восстановление сработало на «${name}» — держим цель: ${pick.line}.`;
  }
  // N: after L recovery, don't blindly re-nudge soft deload.
  const recovery = getLeverMemory(name)?.recovery;
  if (recovery && pick.missStreak >= 1) {
    return `«${name}» после восстановления мимо — смените цель: ${pick.line}.`;
  }
  if (pick.missStreak >= 2) {
    if (pick.lever === "weight") {
      return early
        ? `Два раза не добрали «${name}» — чуть легче или другая цель: ${pick.line}.`
        : `Два раза не добрали «${name}» — облегчите вес или смените цель: ${pick.line}.`;
    }
    return early
      ? `Два раза не добрали «${name}» — облегчите или смените цель: ${pick.line}.`
      : `Два раза не добрали «${name}» — смените цель или облегчите: ${pick.label.toLowerCase()} (${pick.line}).`;
  }
  if (pick.adviceKind === "stall" || pick.adviceKind === "deload") {
    if (pick.lever === "weight") {
      return early
        ? `Плато на «${name}» — чуть легче: ${pick.line}.`
        : `Плато на «${name}» — облегчите вес: ${pick.line}.`;
    }
    return `Плато на «${name}» — без нового веса: ${pick.label.toLowerCase()} (${pick.line}).`;
  }
  if (early) {
    return `В следующий раз на «${name}»: чуть тяжелее или +1 повтор — ${pick.line}.`;
  }
  if (pick.lever === "volume") {
    return `Следующий раз на «${name}»: ${pick.line}.`;
  }
  if (pick.lever === "reps") {
    return `Сначала повторы на «${name}»: ${pick.line}.`;
  }
  return `Фокус на весе «${name}»: ${pick.line}.`;
}

/**
 * Infer which lever an AI tip talked about, constrained to `allowed`.
 * Returns null if ambiguous or outside the set.
 */
export function detectLeverInTip(
  tip: string,
  allowed: readonly ProgressionLever[],
): ProgressionLever | null {
  const hits = allowed.filter((l) => LEVER_WORDS[l].test(tip));
  if (hits.length === 1) return hits[0]!;
  return null;
}

/** Build GigaChat prompt that locks tip to one exercise and optional fixed lever. */
export function buildTipPrompt(pick: TipLeverPick, opts?: { earlyUser?: boolean }): string {
  const lines = pick.options
    .map((o) => `- ${o.lever} / ${o.label}: ${o.line}`)
    .join("\n");
  const early = Boolean(opts?.earlyUser);
  const lock = pick.missStreak >= 2
    ? `Пользователь ${pick.missStreak} раза подряд не взял цель «${pick.label}» (${pick.lever}). Мягко предложи чуть легче или смену цели; цель: ${pick.line}. Не стыди. Не говори «рычаг» и «soft deload».`
    : pick.fromPreference
      ? `Пользователь уже выбрал цель «${pick.label}» (${pick.lever}): ${pick.line}. Перефразируй ТОЛЬКО этот выбор — не предлагай другие. Не говори «рычаг».`
      : early
        ? `Выбери РОВНО ОДНУ цель из списка (weight|volume|reps) простым языком. Без слова «рычаг».`
        : `Выбери РОВНО ОДНУ цель из списка (weight|volume|reps) и опиши только её. Не упоминай остальные.`;
  return [
    "Ты — краткий тренер. Одно предложение на русском, макс 140 символов.",
    "Без списков, без медицины, без стыда. Не выдумывай упражнения и веса.",
    early ? "Язык для новичка: «цель», «чуть тяжелее», «+1 повтор» — без жаргона." : "",
    `Упражнение: ${pick.exerciseName} (${pick.adviceKind}).`,
    lock,
    lines ? `Допустимые варианты:\n${lines}` : `Цель: ${pick.line}`,
    pick.fromPreference
      ? ""
      : `В конце ответа в скобках укажи код: (weight) или (volume) или (reps).`,
  ]
    .filter(Boolean)
    .join("\n");
}

/** Strip trailing `(weight|volume|reps)` annotation from AI tip. */
export function stripLeverAnnotation(tip: string): {
  tip: string;
  lever: ProgressionLever | null;
} {
  const m = tip.match(/\((weight|volume|reps)\)\s*$/i);
  if (!m) return { tip: tip.trim(), lever: null };
  const lever = m[1]!.toLowerCase() as ProgressionLever;
  return {
    tip: tip.replace(/\s*\((weight|volume|reps)\)\s*$/i, "").trim(),
    lever,
  };
}
