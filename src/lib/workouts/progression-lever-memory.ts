/**
 * G1 — remember which progression lever the user picked per exercise
 * (weight / volume / reps) after a session summary.
 * Local-only; keyed by normalized exercise name.
 */

import type { ProgressionLever, ProgressionOption } from "@/lib/workouts/progression";

export const PROGRESSION_LEVER_MEMORY_KEY = "cv-workout-lever-memory-v1";

export type LeverRecoveryKind = "deload" | "switch";

export type LeverMemoryEntry = {
  lever: ProgressionLever;
  /** Max working kg when the choice was made. */
  basisKg: number | null;
  targetKg: number | null;
  targetReps: number | null;
  /** Session date (YYYY-MM-DD) when saved. */
  at: string;
  name: string;
  /** N: L recovery still armed until a hit clears it. */
  recovery?: LeverRecoveryKind | null;
};

type Store = Record<string, LeverMemoryEntry>;

const LEVERS = new Set<ProgressionLever>(["weight", "volume", "reps"]);

export function normalizeExerciseKey(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, " ");
}

function readStore(): Store {
  try {
    if (typeof localStorage === "undefined") return {};
    const raw = localStorage.getItem(PROGRESSION_LEVER_MEMORY_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object") return {};
    return parsed as Store;
  } catch {
    return {};
  }
}

function writeStore(store: Store): void {
  try {
    if (typeof localStorage === "undefined") return;
    const keys = Object.keys(store);
    // Cap growth — keep newest ~80 exercises.
    if (keys.length > 80) {
      const sorted = keys
        .map((k) => ({ k, at: store[k]!.at }))
        .sort((a, b) => (a.at < b.at ? 1 : -1))
        .slice(0, 80);
      const next: Store = {};
      for (const { k } of sorted) next[k] = store[k]!;
      localStorage.setItem(PROGRESSION_LEVER_MEMORY_KEY, JSON.stringify(next));
      return;
    }
    localStorage.setItem(PROGRESSION_LEVER_MEMORY_KEY, JSON.stringify(store));
  } catch {
    // private mode
  }
}

export function getLeverMemory(name: string): LeverMemoryEntry | null {
  const key = normalizeExerciseKey(name);
  if (!key) return null;
  const entry = readStore()[key];
  if (!entry || !LEVERS.has(entry.lever)) return null;
  return entry;
}

export function setLeverMemory(input: {
  name: string;
  lever: ProgressionLever;
  basisKg?: number | null;
  targetKg?: number | null;
  targetReps?: number | null;
  at?: string;
  recovery?: LeverRecoveryKind | null;
}): LeverMemoryEntry | null {
  const key = normalizeExerciseKey(input.name);
  if (!key || !LEVERS.has(input.lever)) return null;
  const entry: LeverMemoryEntry = {
    name: input.name.trim(),
    lever: input.lever,
    basisKg: input.basisKg ?? null,
    targetKg: input.targetKg ?? null,
    targetReps: input.targetReps ?? null,
    at: input.at ?? new Date().toISOString().slice(0, 10),
    recovery: input.recovery ?? null,
  };
  if (!entry.recovery) delete entry.recovery;
  const store = readStore();
  store[key] = entry;
  writeStore(store);
  return entry;
}

/** N: clear recovery flag after a hit (keep lever/targets). */
export function clearLeverRecoveryFlag(name: string): void {
  const mem = getLeverMemory(name);
  if (!mem?.recovery) return;
  setLeverMemory({
    name: mem.name,
    lever: mem.lever,
    basisKg: mem.basisKg,
    targetKg: mem.targetKg,
    targetReps: mem.targetReps,
    at: mem.at,
    recovery: null,
  });
}

export function clearLeverMemory(name: string): void {
  const key = normalizeExerciseKey(name);
  if (!key) return;
  const store = readStore();
  if (!(key in store)) return;
  delete store[key];
  writeStore(store);
}

/** Prefer remembered lever when present among options; else keep advice primary. */
export function resolvePreferredLever(
  options: readonly ProgressionOption[],
  advicePrimary: ProgressionLever | null | undefined,
  remembered: ProgressionLever | null | undefined,
): ProgressionLever | null {
  if (remembered && options.some((o) => o.lever === remembered)) return remembered;
  if (advicePrimary && options.some((o) => o.lever === advicePrimary)) return advicePrimary;
  return options[0]?.lever ?? null;
}

export function pickOptionForLever(
  options: readonly ProgressionOption[],
  lever: ProgressionLever | null | undefined,
): ProgressionOption | null {
  if (!lever) return options[0] ?? null;
  return options.find((o) => o.lever === lever) ?? options[0] ?? null;
}

/**
 * Concrete next-session draft from a remembered (or primary) lever.
 * Used when opening an exercise / autofilling the first working set.
 */
export function goalFromLeverOption(opt: ProgressionOption | null): {
  lever: ProgressionLever | null;
  kg: number | null;
  reps: number | null;
  extraSet: boolean;
} {
  if (!opt) return { lever: null, kg: null, reps: null, extraSet: false };
  return {
    lever: opt.lever,
    kg: opt.suggestedKg,
    reps: opt.suggestedReps,
    extraSet: opt.lever === "volume",
  };
}

/** Map of normalizeExerciseKey → lever for buildNextSessionTargets. */
export function collectPreferredLevers(
  names: readonly string[],
): Record<string, ProgressionLever> {
  const out: Record<string, ProgressionLever> = {};
  for (const name of names) {
    const mem = getLeverMemory(name);
    if (!mem) continue;
    out[normalizeExerciseKey(name)] = mem.lever;
  }
  return out;
}

/**
 * Re-point advice primary + suggestedKg/reps to remembered (or rule) lever.
 * Returns a shallow copy when options exist; otherwise the original advice.
 */
export function adviceWithPreferredLever(
  advice: {
    primaryLever?: ProgressionLever;
    suggestedKg: number | null;
    options?: ProgressionOption[];
  },
  exerciseName: string,
): {
  primaryLever: ProgressionLever | null;
  suggestedKg: number | null;
  suggestedReps: number | null;
  leverRemembered: boolean;
  option: ProgressionOption | null;
} {
  const options = advice.options ?? [];
  const remembered = getLeverMemory(exerciseName)?.lever ?? null;
  const primary = resolvePreferredLever(
    options,
    advice.primaryLever ?? null,
    remembered,
  );
  const option = pickOptionForLever(options, primary);
  return {
    primaryLever: primary,
    suggestedKg: option?.suggestedKg ?? advice.suggestedKg,
    suggestedReps: option?.suggestedReps ?? null,
    leverRemembered: Boolean(remembered && primary === remembered),
    option,
  };
}
