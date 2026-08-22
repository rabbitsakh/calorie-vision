import type { FoodRecognitionResult } from "@/lib/food-types";
import { lookupFoodWithGigaChat } from "@/lib/ai/gigachat";
import { mapPool } from "@/lib/async-pool";
import { offMatchesQuery, searchOpenFoodFactsBest, type PackNutrition } from "@/lib/open-food-facts";
import { lookupRuNutritionTable } from "@/lib/ru-nutrition-lookup";
import { simplifyDishNameForLookup } from "@/lib/recognition-nutrition";

type Alternative = NonNullable<FoodRecognitionResult["alternatives"]>[number];

const OFF_ALT_LOOKUP_CONCURRENCY = 2;
const GIGACHAT_ALT_LOOKUP_CONCURRENCY = 1;
const MAX_OFF_ALT_LOOKUPS = 3;
const MAX_GIGACHAT_ALT_LOOKUPS = 2;
const DEFAULT_OFF_ALT_BUDGET_MS = 2500;
const DEFAULT_GIGACHAT_ALT_BUDGET_MS = 4000;

export type AlternativeEnrichmentOptions = {
  search?: (queries: string[]) => Promise<PackNutrition | null>;
  lookup?: (dishName: string) => Promise<FoodRecognitionResult>;
  maxLookups?: number;
  maxGigaChatLookups?: number;
  deadlineMs?: number;
};

export function alternativeNeedsMacroBackfill(alt: Alternative): boolean {
  if (!(alt.calories > 0)) {
    return false;
  }
  const macroCount = [alt.protein, alt.fat, alt.carbs].filter(
    (value) => value !== undefined && Number.isFinite(value),
  ).length;
  return macroCount < 2;
}

function scaleMacro(value: number | undefined, ratio: number): number | undefined {
  if (value === undefined || !Number.isFinite(value)) {
    return undefined;
  }
  return Math.round(value * ratio * 10) / 10;
}

export function backfillAlternativeFromPack(alt: Alternative, pack: PackNutrition): Alternative {
  const ratio = pack.calories > 0 && alt.calories > 0 ? alt.calories / pack.calories : 1;

  return {
    ...alt,
    protein: alt.protein ?? scaleMacro(pack.protein, ratio),
    fat: alt.fat ?? scaleMacro(pack.fat, ratio),
    carbs: alt.carbs ?? scaleMacro(pack.carbs, ratio),
    fiber: alt.fiber ?? scaleMacro(pack.fiber, ratio),
    sugar: alt.sugar ?? scaleMacro(pack.sugar, ratio),
    portionGrams: alt.portionGrams ?? pack.portionGrams,
  };
}

/** Fill missing alternative macros from the offline RU staples table (#8). */
export function enrichAlternativesFromRuTable(
  result: FoodRecognitionResult,
): FoodRecognitionResult {
  if (!result.alternatives?.length) {
    return result;
  }

  const alternatives = result.alternatives.map((alt) => {
    if (!alternativeNeedsMacroBackfill(alt)) {
      return alt;
    }
    const pack = lookupRuNutritionTable(alt.dishName);
    if (!pack) {
      return alt;
    }
    return backfillAlternativeFromPack(alt, pack);
  });

  return { ...result, alternatives };
}

function alternativeLookupQueries(alt: Alternative): string[] {
  const simplified = simplifyDishNameForLookup(alt.dishName);
  return [alt.dishName, simplified].filter(
    (query): query is string => Boolean(query && query.trim().length >= 3),
  );
}

/** Fill missing alternative macros from Open Food Facts when RU table misses (#8). */
export async function enrichAlternativesFromOff(
  result: FoodRecognitionResult,
  options?: AlternativeEnrichmentOptions,
): Promise<FoodRecognitionResult> {
  if (!result.alternatives?.length) {
    return result;
  }

  const search = options?.search ?? searchOpenFoodFactsBest;
  const maxLookups = options?.maxLookups ?? MAX_OFF_ALT_LOOKUPS;
  const deadlineMs = options?.deadlineMs ?? Date.now() + DEFAULT_OFF_ALT_BUDGET_MS;

  const targets = result.alternatives
    .map((alt, index) => ({ alt, index }))
    .filter(({ alt }) => alternativeNeedsMacroBackfill(alt))
    .slice(0, maxLookups);

  if (targets.length === 0) {
    return result;
  }

  const updates = await mapPool(targets, OFF_ALT_LOOKUP_CONCURRENCY, async ({ alt, index }) => {
    if (Date.now() >= deadlineMs) {
      return { index, alt };
    }

    const queries = alternativeLookupQueries(alt);
    if (queries.length === 0) {
      return { index, alt };
    }

    const pack = await search(queries);
    if (!pack || !offMatchesQuery(alt.dishName, pack.dishName, pack.brand)) {
      return { index, alt };
    }

    return { index, alt: backfillAlternativeFromPack(alt, pack) };
  });

  const alternatives = [...result.alternatives];
  for (const { index, alt } of updates) {
    alternatives[index] = alt;
  }

  return { ...result, alternatives };
}

/** Fill missing alternative macros via GigaChat name lookup when RU/OFF miss (#8). */
export async function enrichAlternativesFromGigaChat(
  result: FoodRecognitionResult,
  options?: AlternativeEnrichmentOptions,
): Promise<FoodRecognitionResult> {
  if (!result.alternatives?.length) {
    return result;
  }

  const lookup = options?.lookup ?? lookupFoodWithGigaChat;
  const maxLookups = options?.maxGigaChatLookups ?? MAX_GIGACHAT_ALT_LOOKUPS;
  const deadlineMs = options?.deadlineMs ?? Date.now() + DEFAULT_GIGACHAT_ALT_BUDGET_MS;

  const targets = result.alternatives
    .map((alt, index) => ({ alt, index }))
    .filter(({ alt }) => alternativeNeedsMacroBackfill(alt))
    .slice(0, maxLookups);

  if (targets.length === 0) {
    return result;
  }

  const updates = await mapPool(targets, GIGACHAT_ALT_LOOKUP_CONCURRENCY, async ({ alt, index }) => {
    if (Date.now() >= deadlineMs) {
      return { index, alt };
    }

    try {
      const pack = await lookup(alt.dishName);
      if (!(pack.calories > 0)) {
        return { index, alt };
      }
      return {
        index,
        alt: backfillAlternativeFromPack(alt, {
          dishName: pack.dishName,
          calories: pack.calories,
          protein: pack.protein,
          fat: pack.fat,
          carbs: pack.carbs,
          fiber: pack.fiber,
          sugar: pack.sugar,
          portionGrams: pack.portionGrams ?? alt.portionGrams ?? 100,
        }),
      };
    } catch {
      return { index, alt };
    }
  });

  const alternatives = [...result.alternatives];
  for (const { index, alt } of updates) {
    alternatives[index] = alt;
  }

  return { ...result, alternatives };
}

/** RU table first, then OFF, then GigaChat for calories-only vision alternatives. */
export async function enrichAlternatives(
  result: FoodRecognitionResult,
  options?: AlternativeEnrichmentOptions,
): Promise<FoodRecognitionResult> {
  const afterRu = enrichAlternativesFromRuTable(result);
  const afterOff = await enrichAlternativesFromOff(afterRu, options);
  return enrichAlternativesFromGigaChat(afterOff, options);
}
