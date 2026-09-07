import { lookupQueriesForName } from "@/lib/dish-lookup-synonyms";
import { simplifyDishNameForLookup } from "@/lib/recognition-nutrition";

export function normalizeDishName(name: string): string {
  return name
    .toLowerCase()
    .replace(/ё/g, "е")
    .replace(/[^a-zа-я0-9]+/gi, " ")
    .trim();
}

export function shouldSkipDishName(name: string): boolean {
  const normalized = normalizeDishName(name);
  return normalized.length < 2 || /не удалось распознать/.test(normalized);
}

export function mealNeedsImage(imagePath: string | null | undefined): boolean {
  if (!imagePath || !imagePath.trim()) {
    return true;
  }

  return imagePath.startsWith("http://") || imagePath.startsWith("https://");
}

/**
 * Query variants for product-photo backfill (OFF / Wikipedia).
 * Longer marketing names often miss; shorter cores hit better.
 */
export function dishImageLookupQueries(dishName: string, limit = 5): string[] {
  const trimmed = dishName.trim();
  if (trimmed.length < 2) {
    return [];
  }

  const simplified = simplifyDishNameForLookup(trimmed);
  const out: string[] = [];
  const push = (value: string | null | undefined) => {
    const next = value?.trim() ?? "";
    if (next.length < 3) {
      return;
    }
    const key = normalizeDishName(next);
    if (!key || out.some((item) => normalizeDishName(item) === key)) {
      return;
    }
    out.push(next);
  };

  for (const query of lookupQueriesForName(trimmed, simplified, limit)) {
    push(query);
  }

  const tokens = normalizeDishName(trimmed).split(" ").filter(Boolean);
  if (tokens.length >= 3) {
    push(tokens.slice(1).join(" "));
    push(tokens.slice(-2).join(" "));
  }
  if (tokens.length >= 2) {
    push(tokens.slice(-2).join(" "));
    // Bare last token only when it looks like food ("подушечки"), never brands ("Маска", "Bombbar").
    const last = tokens[tokens.length - 1]!;
    if (last.length >= 5 && looksLikeFoodToken(last)) {
      push(last);
    }
  }

  return out.slice(0, limit);
}

function looksLikeFoodToken(token: string): boolean {
  return /(каш|суп|борщ|салат|яйц|куриц|индейк|мяс|напит|сок|хлеб|пицц|паст|рис|греч|овсян|творог|йогурт|сыр|конфет|шоколад|батончик|печень|подушечк|варен|тушен|котлет|молоко|кефир|орех|фрукт|ягод|овощ|картоф|макарон|пельмен|блин|вафл|candy|chocolate|yogurt|cheese|bread|soup|salad|chicken|turkey|porridge|pasta|pizza|snack|bar)/i.test(
    token,
  );
}
