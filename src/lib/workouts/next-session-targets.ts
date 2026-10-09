/**
 * Post-finish «Следующий раз» targets from rule progression (optional AI tip separate).
 */

import {
  adviseCardioProgression,
  adviseProgression,
  type ProgressionAdvice,
  type ProgressionPoint,
} from "@/lib/workouts/progression";
import { formatSuggestedKg } from "@/lib/workouts/suggested-load";

export type NextSessionTargetInput = {
  name: string;
  kind: string;
  lastWorkingKg: number | null;
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
  line: string;
  suggestedKg: number | null;
};

export type NextSessionTargetsCard = {
  title: string;
  targets: NextSessionTarget[];
};

function formatStrengthLine(
  name: string,
  advice: ProgressionAdvice,
): string {
  if (advice.suggestedKg != null && advice.suggestedKg > 0) {
    const kg = formatSuggestedKg(advice.suggestedKg);
    if (advice.kind === "stall" || advice.kind === "deload") {
      return `${name} → deload ${kg} кг`;
    }
    if (advice.kind === "hold") {
      return `${name} → ${kg} кг`;
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
  return adviseProgression(ex.points, progressRate, ex.lastWorkingKg);
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
      // Keep one base hint only if nothing else will show.
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
    return `Есть плато на «${stall.name}» — soft deload, потом снова вверх.`;
  }
  const progress = targets.filter((t) => t.adviceKind === "progress");
  if (progress.length > 0) {
    return `Фокус: ${progress
      .slice(0, 2)
      .map((t) => t.line)
      .join("; ")}.`;
  }
  return `Повторите план: ${targets
    .slice(0, 2)
    .map((t) => t.line)
    .join("; ")}.`;
}
