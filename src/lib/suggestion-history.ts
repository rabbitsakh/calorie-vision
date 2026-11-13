/**
 * Rank user's frequent meals / favorites to fill remaining macros.
 * Used by /api/suggestions (Wave K) — history first, then AI/rule pad.
 */

import { POST_WORKOUT_PROTEIN_RATIO } from "@/lib/post-workout-nudge";

export type MealSlot = "breakfast" | "lunch" | "dinner" | "snack";

/**
 * Fixed slack, not a share of the remainder.
 * 50 kcal covers a rounded portion and a photo estimate.
 * 1.35× of a 2 000 kcal remainder used to let a 2 700 kcal dish through.
 */
export const MEAL_KCAL_SLACK = 50;

export function mealSlotFromType(mealType: string | null | undefined): MealSlot | null {
  switch (mealType) {
    case "BREAKFAST":
      return "breakfast";
    case "LUNCH":
      return "lunch";
    case "DINNER":
      return "dinner";
    case "SNACK":
      return "snack";
    default:
      return null;
  }
}

export function fitsRemainingKcal(
  calories: number,
  remainingKcal: number,
  slack = MEAL_KCAL_SLACK,
): boolean {
  return calories > 0 && calories <= remainingKcal + slack;
}

/** Empty slots mean “any meal” (favorites, model). Known slots must include this one. */
export function fitsMealSlot(slots: readonly MealSlot[] | undefined, mealSlot?: MealSlot | null): boolean {
  if (!mealSlot) return true;
  if (!slots || slots.length === 0) return true;
  return slots.includes(mealSlot);
}

export type HistoryMealCandidate = {
  name: string;
  calories: number;
  protein: number;
  fat: number;
  carbs: number;
  portionGrams: number;
  /** Times logged (history) or useCount (favorite). */
  count: number;
  source: "history" | "favorite";
  /** Meal slots this dish was actually logged in. Empty = not known. */
  slots?: MealSlot[];
};

export type MacroRemaining = {
  calories: number;
  protein: number;
  fat: number;
  carbs: number;
};

export type RankedSuggestion = {
  name: string;
  calories: number;
  protein: number;
  fat: number;
  carbs: number;
  portionGrams: number;
  why: string;
  category: "protein" | "carbs" | "fat" | "balanced" | "light";
  slots?: MealSlot[];
};

function normalizeName(name: string): string {
  return name.trim().toLowerCase().replace(/ё/g, "е").replace(/\s+/g, " ");
}

/** Score how well a candidate fills remaining macros (higher = better). */
export function scoreHistoryForRemaining(
  candidate: HistoryMealCandidate,
  remaining: MacroRemaining,
  mealSlot?: MealSlot | null,
): number {
  if (!fitsRemainingKcal(candidate.calories, remaining.calories)) return -1;
  if (!fitsMealSlot(candidate.slots, mealSlot)) return -1;
  const proteinNeed = Math.max(0, remaining.protein);
  const proteinHit = Math.min(candidate.protein, proteinNeed);
  const kcalFit =
    remaining.calories > 0
      ? 1 - Math.min(1, Math.abs(candidate.calories - Math.min(candidate.calories, remaining.calories)) / remaining.calories)
      : 0;
  const proteinDensity = candidate.calories > 0 ? candidate.protein / candidate.calories : 0;
  const freqBoost = Math.min(8, Math.log2(1 + candidate.count) * 2);
  const favoriteBoost = candidate.source === "favorite" ? 1.5 : 0;

  let score = proteinHit * 3 + proteinDensity * 40 + kcalFit * 10 + freqBoost + favoriteBoost;
  if (proteinNeed >= 15 && candidate.protein >= 12) score += 12;
  if (proteinNeed < 8 && candidate.protein > proteinNeed + 20) score -= 8;
  return score;
}

/** Best high-protein pick from history that roughly fits remaining kcal. */
export function pickHighProteinFromHistory(
  candidates: HistoryMealCandidate[],
  remaining: MacroRemaining,
  mealSlot?: MealSlot | null,
): HistoryMealCandidate | null {
  let best: HistoryMealCandidate | null = null;
  let bestScore = -Infinity;
  for (const c of candidates) {
    if (c.protein < 8) continue;
    if (!fitsRemainingKcal(c.calories, remaining.calories)) continue;
    if (!fitsMealSlot(c.slots, mealSlot)) continue;
    const density = c.calories > 0 ? c.protein / c.calories : 0;
    const score = c.protein * 2 + density * 50 + Math.min(6, Math.log2(1 + c.count));
    if (score > bestScore) {
      bestScore = score;
      best = c;
    }
  }
  return best;
}

export function candidateToSuggestion(
  candidate: HistoryMealCandidate,
  options?: { postWorkout?: boolean },
): RankedSuggestion {
  const proteinHeavy = candidate.protein >= 15 || (candidate.calories > 0 && candidate.protein / candidate.calories >= 0.12);
  const why = options?.postWorkout
    ? `После зала — из ваших блюд (${candidate.count}×)`
    : candidate.source === "favorite"
      ? "Из избранного"
      : `Часто ели (${candidate.count}×)`;
  return {
    name: candidate.name,
    calories: Math.round(candidate.calories),
    protein: Math.round(candidate.protein * 10) / 10,
    fat: Math.round(candidate.fat * 10) / 10,
    carbs: Math.round(candidate.carbs * 10) / 10,
    portionGrams: Math.round(candidate.portionGrams) || 0,
    why,
    category: proteinHeavy ? "protein" : "balanced",
    slots: candidate.slots,
  };
}

export function rankHistorySuggestions(
  candidates: HistoryMealCandidate[],
  remaining: MacroRemaining,
  limit = 3,
  mealSlot?: MealSlot | null,
): RankedSuggestion[] {
  const scored = candidates
    .map((c) => ({ c, score: scoreHistoryForRemaining(c, remaining, mealSlot) }))
    .filter((row) => row.score >= 0)
    .sort((a, b) => b.score - a.score);

  const out: RankedSuggestion[] = [];
  const seen = new Set<string>();
  for (const row of scored) {
    const key = normalizeName(row.c.name);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(candidateToSuggestion(row.c));
    if (out.length >= limit) break;
  }
  return out;
}

/**
 * Merge history picks with AI/fallback. When pinProteinFirst, force a high-protein
 * history meal into slot 0 (post-workout / gym-today protein gap).
 */
export function mergeSuggestions(input: {
  history: HistoryMealCandidate[];
  others: RankedSuggestion[];
  remaining: MacroRemaining;
  pinProteinFirst?: boolean;
  mealSlot?: MealSlot | null;
  limit?: number;
}): RankedSuggestion[] {
  const limit = input.limit ?? 3;
  const out: RankedSuggestion[] = [];
  const seen = new Set<string>();

  const push = (s: RankedSuggestion) => {
    const key = normalizeName(s.name);
    if (!key || seen.has(key)) return;
    if (out.length >= limit) return;
    if (!fitsRemainingKcal(s.calories, input.remaining.calories)) return;
    if (!fitsMealSlot(s.slots, input.mealSlot)) return;
    seen.add(key);
    out.push(s);
  };

  if (input.pinProteinFirst) {
    const pinned = pickHighProteinFromHistory(input.history, input.remaining, input.mealSlot);
    if (pinned) {
      push(candidateToSuggestion(pinned, { postWorkout: true }));
    }
  }

  for (const s of rankHistorySuggestions(input.history, input.remaining, limit, input.mealSlot)) {
    push(s);
  }
  for (const s of input.others) {
    push(s);
  }
  return out.slice(0, limit);
}

/** Pin when client says post-workout OR gym today with protein soft-short. */
export function shouldPinPostWorkoutProtein(input: {
  postWorkoutParam?: boolean;
  gymToday: boolean;
  eatenProtein: number;
  proteinTarget: number;
  ratio?: number;
}): boolean {
  const ratio = input.ratio ?? POST_WORKOUT_PROTEIN_RATIO;
  if (input.postWorkoutParam) return true;
  if (!input.gymToday) return false;
  if (!(input.proteinTarget > 0)) return false;
  return input.eatenProtein < input.proteinTarget * ratio;
}

/** Aggregate meal rows into history candidates (count ≥ minCount). */
export function aggregateMealHistory(
  rows: Array<{
    dishName: string;
    calories: number;
    protein?: number | null;
    fat?: number | null;
    carbs?: number | null;
    portionGrams?: number | null;
    mealType?: string | null;
  }>,
  minCount = 2,
): HistoryMealCandidate[] {
  const map = new Map<string, HistoryMealCandidate>();
  for (const row of rows) {
    const name = row.dishName.trim();
    if (name.length < 2) continue;
    const key = normalizeName(name);
    const slot = mealSlotFromType(row.mealType);
    const existing = map.get(key);
    if (!existing) {
      map.set(key, {
        name,
        calories: row.calories,
        protein: row.protein ?? 0,
        fat: row.fat ?? 0,
        carbs: row.carbs ?? 0,
        portionGrams: row.portionGrams ?? 0,
        count: 1,
        source: "history",
        slots: slot ? [slot] : [],
      });
      continue;
    }
    existing.count += 1;
    if (slot && existing.slots && !existing.slots.includes(slot)) existing.slots.push(slot);
    // Keep latest-ish macros (rows usually newest-first).
    if (existing.protein <= 0 && row.protein != null) existing.protein = row.protein;
    if (existing.fat <= 0 && row.fat != null) existing.fat = row.fat;
    if (existing.carbs <= 0 && row.carbs != null) existing.carbs = row.carbs;
  }
  return [...map.values()]
    .filter((c) => c.count >= minCount)
    .sort((a, b) => b.count - a.count);
}
