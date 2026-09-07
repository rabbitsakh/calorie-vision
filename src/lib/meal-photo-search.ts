import {
  searchFoodImageCandidates,
  type FoodImageCandidate,
} from "@/lib/food-image";
import { dishImageLookupQueries } from "@/lib/meal-image";
import { searchOpenFoodFactsImageCandidates } from "@/lib/open-food-facts";
import { cacheRemoteImage } from "@/lib/upload";

export type MealPhotoCandidate = FoodImageCandidate;

/** Search OFF + Wikipedia/Commons for dish photo candidates. */
export async function searchMealPhotoCandidates(
  dishName: string,
  limit = 10,
): Promise<MealPhotoCandidate[]> {
  const queries = dishImageLookupQueries(dishName, 4);
  const primary = queries[0] ?? dishName.trim();
  if (primary.length < 2) {
    return [];
  }

  const offLists = await Promise.all(
    queries.slice(0, 2).map((query) => searchOpenFoodFactsImageCandidates(query, 5)),
  );
  const wiki = await searchFoodImageCandidates(primary, {
    limit: Math.max(6, limit),
    mode: "picker",
  });

  const out: MealPhotoCandidate[] = [];
  const seen = new Set<string>();
  const push = (item: MealPhotoCandidate) => {
    if (!item.url || seen.has(item.url) || out.length >= limit) {
      return;
    }
    seen.add(item.url);
    out.push(item);
  };

  for (const list of offLists) {
    for (const item of list) {
      push({ url: item.url, source: "openfoodfacts", label: item.label });
    }
  }
  for (const item of wiki) {
    push(item);
  }

  // Secondary wiki queries if still thin (food-context only inside searchFoodImageCandidates).
  if (out.length < 4) {
    for (const query of queries.slice(1, 3)) {
      const extra = await searchFoodImageCandidates(query, { limit: 4, mode: "picker" });
      for (const item of extra) {
        push(item);
      }
      if (out.length >= limit) {
        break;
      }
    }
  }

  return out;
}

/** Cache a remote candidate and return app-local imagePath. */
export async function applyMealPhotoFromUrl(
  imageUrl: string,
  options?: { ownerUserId?: string },
): Promise<string | null> {
  const cached = await cacheRemoteImage(imageUrl.trim(), {
    ...options,
    allowWebProduct: true,
  });
  return cached ?? null;
}
