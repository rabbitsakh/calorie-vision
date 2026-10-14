/**
 * Post-finish «Следующий раз» targets from rule progression (optional AI tip separate).
 * Strength lines use top working kg (not last drop) and expose weight / volume / reps levers.
 */

import {
  adviseCardioProgression,
  adviseProgression,
  type ProgressionAdvice,
  type ProgressionLever,
  type ProgressionOption,
  type ProgressionPoint,
} from "@/lib/workouts/progression";
import { formatSuggestedKg } from "@/lib/workouts/suggested-load";

export type NextSessionTargetInput = {
  name: string;
  kind: string;
  /** Top working kg this session (exclude drop/warmup). */
  lastWorkingKg: number | null;
  /** Reps on the top working set. */
  lastWorkingReps?: number | null;
  points: readonly ProgressionPoint[];
  load: number;
  completedCount: number;
  cardioDistanceKm?: number;
  cardioDurationSec?: number;
  previousBestPaceSecPerKm?: number | null;
};

export type NextSessionTarget = {
  name: string;
  adviceKind: ProgressionAdvice["kind"];
  title: string;
  /** Primary one-liner (backward compatible). */
  line: string;
  suggestedKg: number | null;
  basisKg: number | null;
  primaryLever: ProgressionLever | null;
  options: ProgressionOption[];
};

export type NextSessionTargetsCard = {
  title: string;
  targets: NextSessionTarget[];
};

function formatStrengthLine(
  name: string,
  advice: ProgressionAdvice,
): string {
  const basis =
    advice.basisKg != null && advice.basisKg > 0
      ? `макс ${formatSuggestedKg(advice.basisKg)} кг`
      : null;
  const primary =
    advice.options?.find((o) => o.lever === advice.primaryLever) ??
    advice.options?.[0];
  if (primary) {
    const head = basis ? `${name} · ${basis}` : name;
    return `${head} → ${primary.label}: ${primary.line}`;
  }
  if (advice.suggestedKg != null && advice.suggestedKg > 0) {
    const kg = formatSuggestedKg(advice.suggestedKg);
    if (advice.kind === "stall" || advice.kind === "deload") {
      return `${name} → deload ${kg} кг`;
    }
    return `${name} → ${kg} кг`;
  }
  return `${name} · ${advice.detail}`;
}

function formatCardioLine(name: string, advice: ProgressionAdvice): string {
  const detail = advice.detail
    .replace(/^Цель в следующий раз:\s*/i, "")
    .replace(/\.$/, "");
  return `${name} → ${detail}`;
}

function adviceForExercise(
  ex: NextSessionTargetInput,
  progressRate: number,
): ProgressionAdvice {
  if (ex.kind === "cardio") {
    return adviseCardioProgression({
      lastDistanceKm: ex.cardioDistanceKm ?? 0,
      lastDurationSec: ex.cardioDurationSec ?? 0,
      previousBestPaceSecPerKm: ex.previousBestPaceSecPerKm ?? null,
    });
  }
  return adviseProgression(
    ex.points,
    progressRate,
    ex.lastWorkingKg,
    ex.lastWorkingReps ?? null,
  );
}

function toTarget(
  ex: NextSessionTargetInput,
  advice: ProgressionAdvice,
): NextSessionTarget {
  const isCardio = ex.kind === "cardio";
  return {
    name: ex.name,
    adviceKind: advice.kind,
    title: advice.title,
    line: isCardio
      ? formatCardioLine(ex.name, advice)
      : formatStrengthLine(ex.name, advice),
    suggestedKg: advice.suggestedKg,
    basisKg: advice.basisKg ?? ex.lastWorkingKg,
    primaryLever: advice.primaryLever ?? null,
    options: isCardio ? [] : advice.options ?? [],
  };
}

/**
 * Pick up to `max` exercises with actionable next-session lines.
 * Prefers completed work by load, then completed set count.
 */
export function buildNextSessionTargets(
  exercises: readonly NextSessionTargetInput[],
  progressRate: number,
  max = 3,
): NextSessionTargetsCard {
  const ranked = [...exercises]
    .filter((ex) => ex.completedCount > 0 || ex.load > 0)
    .sort((a, b) => {
      const loadDiff = b.load - a.load;
      if (loadDiff !== 0) return loadDiff;
      return b.completedCount - a.completedCount;
    });

  const targets: NextSessionTarget[] = [];
  for (const ex of ranked) {
    if (targets.length >= max) break;
    const advice = adviceForExercise(ex, progressRate);
    if (advice.kind === "base" && advice.suggestedKg == null) {
      if (ranked.length === 1 || targets.length === 0) {
        targets.push(toTarget(ex, advice));
      }
      continue;
    }
    targets.push(toTarget(ex, advice));
  }

  return {
    title: "Следующий раз",
    targets,
  };
}

/** Compact rule tip when GigaChat is unavailable. */
export function ruleNextSessionTip(targets: readonly NextSessionTarget[]): string {
  if (targets.length === 0) {
    return "В следующий раз зафиксируйте рабочие веса — подскажем прогрессию.";
  }
  const stall = targets.find((t) => t.adviceKind === "stall" || t.adviceKind === "deload");
  if (stall) {
    return `Есть плато на «${stall.name}» — soft deload, или тоннаж/повторы без нового веса.`;
  }
  const withOptions = targets.find((t) => t.options.length > 0);
  if (withOptions?.primaryLever === "reps") {
    return `Сначала повторы на максе, потом вес: ${withOptions.name}.`;
  }
  if (withOptions?.primaryLever === "volume") {
    return `Добавьте подход на текущем весе: ${withOptions.name}.`;
  }
  const progress = targets.filter((t) => t.adviceKind === "progress");
  if (progress.length > 0) {
    return `Фокус — вес или объём: ${progress
      .slice(0, 2)
      .map((t) => t.name)
      .join(", ")}.`;
  }
  return `Варианты на следующую: вес, тоннаж или повторы — выберите один рычаг.`;
}
