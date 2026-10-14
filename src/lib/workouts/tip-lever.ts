/**
 * G3 — pick exactly one progression lever for the post-session tip.
 * Preference (remembered / primary) wins; AI may only phrase that lever.
 */

import type { ProgressionLever, ProgressionOption } from "@/lib/workouts/progression";

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
};

// Avoid \\b — JS word boundaries ignore Cyrillic letters.
const LEVER_WORDS: Record<ProgressionLever, RegExp> = {
  weight: /(вес|кг|deload)/i,
  volume: /(тоннаж|подход|объ[её]м)/i,
  reps: /(повтор|×|x\s*\d)/i,
};

/** Choose one exercise+lever for the tip. Prefers remembered, then primary. */
export function pickTipFocus(targets: readonly TipTarget[]): TipLeverPick | null {
  if (targets.length === 0) return null;

  const withOptions = targets.filter((t) => t.options.length > 0);
  const pool = withOptions.length > 0 ? withOptions : [...targets];

  const remembered = pool.find((t) => t.leverRemembered && t.primaryLever);
  const focus = remembered ?? pool[0]!;
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
  };
}

/** Rule one-liner locked to the picked lever (no multi-lever advice). */
export function ruleTipForFocus(pick: TipLeverPick): string {
  const name = pick.exerciseName;
  if (pick.adviceKind === "stall" || pick.adviceKind === "deload") {
    if (pick.lever === "weight") {
      return `Плато на «${name}» — soft deload: ${pick.line}.`;
    }
    return `Плато на «${name}» — без нового веса: ${pick.label.toLowerCase()} (${pick.line}).`;
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
export function buildTipPrompt(pick: TipLeverPick): string {
  const opts = pick.options
    .map((o) => `- ${o.lever} / ${o.label}: ${o.line}`)
    .join("\n");
  const lock = pick.fromPreference
    ? `Пользователь уже выбрал рычаг «${pick.label}» (${pick.lever}): ${pick.line}. Перефразируй ТОЛЬКО этот выбор — не предлагай другие рычаги.`
    : `Выбери РОВНО ОДИН рычаг из списка (weight|volume|reps) и опиши только его. Не упоминай остальные.`;
  return [
    "Ты — краткий тренер. Одно предложение на русском, макс 140 символов.",
    "Без списков, без медицины, без стыда. Не выдумывай упражнения и веса.",
    `Упражнение: ${pick.exerciseName} (${pick.adviceKind}).`,
    lock,
    opts ? `Допустимые варианты:\n${opts}` : `Цель: ${pick.line}`,
    pick.fromPreference
      ? ""
      : `В конце ответа в скобках укажи код рычага: (weight) или (volume) или (reps).`,
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
