/**
 * Match a user's CustomFood favorites by typed name (text lookup path).
 */

import { normalizeFoodQueryKey } from "@/lib/food-query-parse";
import type { FoodRecognitionResult } from "@/lib/food-types";
import { prisma } from "@/lib/prisma";

function scoreCustomFood(query: string, name: string): number {
  const q = normalizeFoodQueryKey(query);
  const n = normalizeFoodQueryKey(name);
  if (!q || !n) return 0;
  if (q === n) return 100;
  if (n.includes(q) || q.includes(n)) return 80;
  const qTokens = q.split(" ").filter((t) => t.length > 2);
  const nTokens = n.split(" ").filter((t) => t.length > 2);
  if (qTokens.length === 0) return 0;
  const hits = qTokens.filter((t) => nTokens.some((nt) => nt.includes(t)));
  if (hits.length === qTokens.length) return 70;
  if (hits.length >= Math.ceil(qTokens.length / 2)) return 55;
  return 0;
}

export async function lookupCustomFoodByName(
  dishName: string,
  userId?: string | null,
): Promise<FoodRecognitionResult | null> {
  if (!userId || !dishName.trim()) {
    return null;
  }

  try {
    const foods = await prisma.customFood.findMany({
      where: { userId },
      orderBy: [{ useCount: "desc" }, { updatedAt: "desc" }],
      take: 80,
    });

    let best: (typeof foods)[number] | null = null;
    let bestScore = 0;
    for (const food of foods) {
      const score = scoreCustomFood(dishName, food.name);
      if (score >= 70 && score > bestScore) {
        best = food;
        bestScore = score;
      }
    }
    if (!best) return null;

    return {
      dishName: best.name,
      calories: best.calories,
      protein: best.protein ?? undefined,
      fat: best.fat ?? undefined,
      carbs: best.carbs ?? undefined,
      fiber: best.fiber ?? undefined,
      sugar: best.sugar ?? undefined,
      portionGrams: best.portionGrams ?? undefined,
      confidence: bestScore >= 90 ? 0.88 : 0.78,
      source: "custom-food",
      photoKind: "package",
      lookupMode: "branded",
    };
  } catch (error) {
    console.warn("custom-food lookup failed", error);
    return null;
  }
}
