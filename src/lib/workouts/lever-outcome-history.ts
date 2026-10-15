/**
 * J1 — local hit/miss streak per exercise lever after session summary.
 * Complements progression-lever-memory (which stores the chosen lever + targets).
 */

import type { ProgressionLever } from "@/lib/workouts/progression";
import { normalizeExerciseKey } from "@/lib/workouts/progression-lever-memory";
import type { SessionLeverOutcome } from "@/lib/workouts/lever-set-feedback";

export const LEVER_OUTCOME_HISTORY_KEY = "cv-workout-lever-outcomes-v1";

export type LeverOutcomeRecord = {
  name: string;
  lever: ProgressionLever;
  outcome: SessionLeverOutcome;
  at: string;
};

type Store = Record<string, LeverOutcomeRecord[]>;

const LEVERS = new Set<ProgressionLever>(["weight", "volume", "reps"]);
const MAX_PER_EXERCISE = 12;
const MAX_EXERCISES = 80;

function readStore(): Store {
  try {
    if (typeof localStorage === "undefined") return {};
    const raw = localStorage.getItem(LEVER_OUTCOME_HISTORY_KEY);
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
    if (keys.length > MAX_EXERCISES) {
      // Drop exercises with oldest latest entry.
      const ranked = keys
        .map((k) => {
          const list = store[k] ?? [];
          const at = list[list.length - 1]?.at ?? "";
          return { k, at };
        })
        .sort((a, b) => (a.at < b.at ? 1 : -1))
        .slice(0, MAX_EXERCISES);
      const next: Store = {};
      for (const { k } of ranked) next[k] = store[k]!;
      localStorage.setItem(LEVER_OUTCOME_HISTORY_KEY, JSON.stringify(next));
      return;
    }
    localStorage.setItem(LEVER_OUTCOME_HISTORY_KEY, JSON.stringify(store));
  } catch {
    // private mode
  }
}

export function recordLeverOutcome(input: {
  name: string;
  lever: ProgressionLever;
  outcome: SessionLeverOutcome;
  at?: string;
}): LeverOutcomeRecord | null {
  const key = normalizeExerciseKey(input.name);
  if (!key || !LEVERS.has(input.lever)) return null;
  if (input.outcome !== "hit" && input.outcome !== "miss" && input.outcome !== "partial") {
    return null;
  }
  const entry: LeverOutcomeRecord = {
    name: input.name.trim(),
    lever: input.lever,
    outcome: input.outcome,
    at: input.at ?? new Date().toISOString().slice(0, 10),
  };
  const store = readStore();
  const prev = store[key] ?? [];
  // One record per calendar day (latest wins).
  const withoutToday = prev.filter((r) => r.at !== entry.at);
  const next = [...withoutToday, entry].slice(-MAX_PER_EXERCISE);
  store[key] = next;
  writeStore(store);
  return entry;
}

export type LeverStreak = {
  lever: ProgressionLever;
  /** Consecutive hits ending at the latest record (0 if last was miss/close). */
  hitStreak: number;
  lastOutcome: SessionLeverOutcome;
  lastAt: string;
};

/** Current hit streak for the exercise's latest lever thread. */
export function getLeverHitStreak(name: string): LeverStreak | null {
  const key = normalizeExerciseKey(name);
  if (!key) return null;
  const list = readStore()[key];
  if (!list || list.length === 0) return null;
  const last = list[list.length - 1]!;
  let hitStreak = 0;
  for (let i = list.length - 1; i >= 0; i--) {
    const row = list[i]!;
    if (row.lever !== last.lever) break;
    if (row.outcome !== "hit") break;
    hitStreak += 1;
  }
  return {
    lever: last.lever,
    hitStreak,
    lastOutcome: last.outcome,
    lastAt: last.at,
  };
}

/** Soft label for live logger / summary (J2). */
export function formatLeverStreakHint(streak: LeverStreak | null | undefined): string | null {
  if (!streak) return null;
  if (streak.hitStreak >= 2) {
    return `${streak.hitStreak}× подряд`;
  }
  if (streak.lastOutcome === "hit" && streak.hitStreak === 1) {
    return "цель в прошлый раз";
  }
  if (streak.lastOutcome === "miss") {
    return "в прошлый раз мимо";
  }
  if (streak.lastOutcome === "partial") {
    return "в прошлый раз близко";
  }
  return null;
}

/** Consecutive misses on the latest lever thread (K1). */
export function getLeverMissStreak(name: string): number {
  const key = normalizeExerciseKey(name);
  if (!key) return 0;
  const list = readStore()[key];
  if (!list || list.length === 0) return 0;
  const last = list[list.length - 1]!;
  let missStreak = 0;
  for (let i = list.length - 1; i >= 0; i--) {
    const row = list[i]!;
    if (row.lever !== last.lever) break;
    if (row.outcome !== "miss") break;
    missStreak += 1;
  }
  return missStreak;
}

export function shouldSuggestLeverSwitch(name: string): boolean {
  return getLeverMissStreak(name) >= 2;
}

export type LeverStreakListItem = {
  name: string;
  streak: LeverStreak;
};

/** Top hit streaks across exercises for History hub (K2). */
export function listTopLeverHitStreaks(limit = 3): LeverStreakListItem[] {
  const store = readStore();
  const items: LeverStreakListItem[] = [];
  for (const list of Object.values(store)) {
    if (!list || list.length === 0) continue;
    const name = list[list.length - 1]!.name;
    const streak = getLeverHitStreak(name);
    if (!streak || streak.hitStreak < 2) continue;
    items.push({ name, streak });
  }
  items.sort((a, b) => {
    if (b.streak.hitStreak !== a.streak.hitStreak) {
      return b.streak.hitStreak - a.streak.hitStreak;
    }
    return a.name.localeCompare(b.name, "ru");
  });
  return items.slice(0, Math.max(0, limit));
}

export function resetLeverOutcomeHistoryForTests(): void {
  try {
    if (typeof localStorage === "undefined") return;
    localStorage.removeItem(LEVER_OUTCOME_HISTORY_KEY);
  } catch {
    // ignore
  }
}
