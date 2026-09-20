import { paceSecPerKm } from "@/lib/workouts/cardio";
import { parseExerciseKind, type ExerciseKind } from "@/lib/workouts/exercise-kind";
import { setCountsTowardLoad, parseSetType } from "@/lib/workouts/set-meta";

export type PrSet = {
  weightKg?: number | null;
  reps?: number | null;
  distanceKm?: number | null;
  durationSec?: number | null;
  setType?: string | null;
  completed?: boolean | null;
};

/** Epley estimated 1RM: w * (1 + reps/30). Reps=1 → weight. */
export function estimated1Rm(weightKg: number, reps: number): number {
  if (!Number.isFinite(weightKg) || !Number.isFinite(reps) || weightKg < 0 || reps <= 0) {
    return 0;
  }
  if (reps === 1) return Math.round(weightKg * 10) / 10;
  return Math.round(weightKg * (1 + reps / 30) * 10) / 10;
}

function isWorkingSet(set: PrSet): boolean {
  return setCountsTowardLoad(set) && parseSetType(set.setType) !== "warmup";
}

export type StrengthPrs = {
  kind: "strength" | "weighted_bw";
  heaviestKg: number;
  heaviestReps: number;
  bestSetVolume: number;
  estimated1Rm: number;
};

export type BodyweightPrs = {
  kind: "bodyweight";
  bestReps: number;
};

export type DurationPrs = {
  kind: "duration";
  longestSec: number;
};

export type AssistedPrs = {
  kind: "assisted";
  bestReps: number;
  lightestAssistKg: number | null;
};

export type CardioPrs = {
  kind: "cardio";
  bestPaceSecPerKm: number | null;
  longestDistanceKm: number;
  longestDurationSec: number;
};

export type ExercisePrs =
  | StrengthPrs
  | BodyweightPrs
  | DurationPrs
  | AssistedPrs
  | CardioPrs;

export function computeExercisePrs(
  kindRaw: string | null | undefined,
  sets: readonly PrSet[],
): ExercisePrs {
  const kind = parseExerciseKind(kindRaw);
  const working = sets.filter(isWorkingSet);

  if (kind === "cardio") {
    let bestPace: number | null = null;
    let longestDistanceKm = 0;
    let longestDurationSec = 0;
    for (const s of working) {
      const d = Number(s.distanceKm) || 0;
      const t = Number(s.durationSec) || 0;
      if (d > longestDistanceKm) longestDistanceKm = d;
      if (t > longestDurationSec) longestDurationSec = t;
      const pace = paceSecPerKm(d, t);
      if (pace != null && (bestPace == null || pace < bestPace)) bestPace = pace;
    }
    return {
      kind: "cardio",
      bestPaceSecPerKm: bestPace,
      longestDistanceKm: Math.round(longestDistanceKm * 1000) / 1000,
      longestDurationSec,
    };
  }

  if (kind === "duration") {
    let longestSec = 0;
    for (const s of working) {
      const t = Number(s.durationSec) || 0;
      if (t > longestSec) longestSec = t;
    }
    return { kind: "duration", longestSec };
  }

  if (kind === "bodyweight") {
    let bestReps = 0;
    for (const s of working) {
      const r = Number(s.reps) || 0;
      if (r > bestReps) bestReps = r;
    }
    return { kind: "bodyweight", bestReps };
  }

  if (kind === "assisted") {
    let bestReps = 0;
    let lightest: number | null = null;
    for (const s of working) {
      const r = Number(s.reps) || 0;
      const w = Number(s.weightKg);
      if (r > bestReps) bestReps = r;
      if (Number.isFinite(w) && (lightest == null || w < lightest)) lightest = w;
    }
    return { kind: "assisted", bestReps, lightestAssistKg: lightest };
  }

  // strength | weighted_bw
  let heaviestKg = 0;
  let heaviestReps = 0;
  let bestSetVolume = 0;
  let best1Rm = 0;
  for (const s of working) {
    const w = Number(s.weightKg);
    const r = Number(s.reps);
    if (!Number.isFinite(w) || !Number.isFinite(r) || r <= 0) continue;
    if (w > heaviestKg || (w === heaviestKg && r > heaviestReps)) {
      heaviestKg = w;
      heaviestReps = r;
    }
    const vol = w * r;
    if (vol > bestSetVolume) bestSetVolume = vol;
    const e1 = estimated1Rm(w, r);
    if (e1 > best1Rm) best1Rm = e1;
  }

  return {
    kind: kind === "weighted_bw" ? "weighted_bw" : "strength",
    heaviestKg,
    heaviestReps,
    bestSetVolume: Math.round(bestSetVolume * 10) / 10,
    estimated1Rm: best1Rm,
  };
}

/** Merge PRs across all historical sessions for one exercise (best-of). */
export function mergeExercisePrs(parts: readonly ExercisePrs[]): ExercisePrs | null {
  if (parts.length === 0) return null;
  const first = parts[0]!;
  if (first.kind === "cardio") {
    let bestPace: number | null = null;
    let longestDistanceKm = 0;
    let longestDurationSec = 0;
    for (const p of parts) {
      if (p.kind !== "cardio") continue;
      if (p.longestDistanceKm > longestDistanceKm) longestDistanceKm = p.longestDistanceKm;
      if (p.longestDurationSec > longestDurationSec) longestDurationSec = p.longestDurationSec;
      if (p.bestPaceSecPerKm != null && (bestPace == null || p.bestPaceSecPerKm < bestPace)) {
        bestPace = p.bestPaceSecPerKm;
      }
    }
    return {
      kind: "cardio",
      bestPaceSecPerKm: bestPace,
      longestDistanceKm,
      longestDurationSec,
    };
  }
  if (first.kind === "duration") {
    let longestSec = 0;
    for (const p of parts) {
      if (p.kind === "duration" && p.longestSec > longestSec) longestSec = p.longestSec;
    }
    return { kind: "duration", longestSec };
  }
  if (first.kind === "bodyweight") {
    let bestReps = 0;
    for (const p of parts) {
      if (p.kind === "bodyweight" && p.bestReps > bestReps) bestReps = p.bestReps;
    }
    return { kind: "bodyweight", bestReps };
  }
  if (first.kind === "assisted") {
    let bestReps = 0;
    let lightest: number | null = null;
    for (const p of parts) {
      if (p.kind !== "assisted") continue;
      if (p.bestReps > bestReps) bestReps = p.bestReps;
      if (p.lightestAssistKg != null && (lightest == null || p.lightestAssistKg < lightest)) {
        lightest = p.lightestAssistKg;
      }
    }
    return { kind: "assisted", bestReps, lightestAssistKg: lightest };
  }
  if (first.kind === "strength" || first.kind === "weighted_bw") {
    let heaviestKg = 0;
    let heaviestReps = 0;
    let bestSetVolume = 0;
    let best1Rm = 0;
    const outKind = first.kind;
    for (const p of parts) {
      if (p.kind !== "strength" && p.kind !== "weighted_bw") continue;
      if (p.heaviestKg > heaviestKg || (p.heaviestKg === heaviestKg && p.heaviestReps > heaviestReps)) {
        heaviestKg = p.heaviestKg;
        heaviestReps = p.heaviestReps;
      }
      if (p.bestSetVolume > bestSetVolume) bestSetVolume = p.bestSetVolume;
      if (p.estimated1Rm > best1Rm) best1Rm = p.estimated1Rm;
    }
    return {
      kind: outKind,
      heaviestKg,
      heaviestReps,
      bestSetVolume,
      estimated1Rm: best1Rm,
    };
  }
  return null;
}

export function formatPrSummary(prs: ExercisePrs): string | null {
  switch (prs.kind) {
    case "strength":
    case "weighted_bw":
      if (prs.heaviestKg <= 0) return null;
      return `PR ${prs.heaviestKg} кг × ${prs.heaviestReps} · ~1ПМ ${prs.estimated1Rm} кг`;
    case "bodyweight":
      return prs.bestReps > 0 ? `PR ${prs.bestReps} повт` : null;
    case "duration":
      return prs.longestSec > 0 ? `PR ${Math.round(prs.longestSec)} с` : null;
    case "assisted":
      return prs.bestReps > 0
        ? `PR ${prs.bestReps} повт${prs.lightestAssistKg != null ? ` · помощь ${prs.lightestAssistKg} кг` : ""}`
        : null;
    case "cardio": {
      const parts: string[] = [];
      if (prs.longestDistanceKm > 0) parts.push(`${prs.longestDistanceKm} км`);
      if (prs.bestPaceSecPerKm != null) {
        const m = Math.floor(prs.bestPaceSecPerKm / 60);
        const s = Math.round(prs.bestPaceSecPerKm % 60)
          .toString()
          .padStart(2, "0");
        parts.push(`${m}:${s}/км`);
      }
      return parts.length ? `PR ${parts.join(" · ")}` : null;
    }
    default:
      return null;
  }
}
