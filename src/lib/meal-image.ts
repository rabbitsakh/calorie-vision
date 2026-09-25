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

/** Drop freshness / home-style adjectives that hurt OFF / packaging search. */
const FRESHNESS_TOKEN =
  /^(свеж(ий|ая|ее|ие|их|им|ими)?|молод(ой|ая|ое|ые)|сырой|сырая|сырое|сырые|домашн(ий|яя|ее|ие)|нарезанн(ый|ая|ое|ые)|мытый|мытая)$/i;

export function stripFreshnessAdjectives(name: string): string {
  const tokens = name
    .trim()
    .split(/\s+/)
    .filter((t) => t.length > 0 && !FRESHNESS_TOKEN.test(t));
  return tokens.join(" ").trim();
}

/** Produce / raw vegetable-fruit tokens — prefer Wikipedia Commons over packaging. */
const PRODUCE_TOKEN =
  /(сельдере|celery|огурц|cucumber|помидор|томат|tomato|морков|carrot|капуст|cabbage|свекл|beet|чеснок|garlic|кабачк|zucchini|баклажан|eggplant|редис|radish|укроп|dill|петрушк|parsley|шпинат|spinach|брокколи|broccoli|яблок|банан|груш|апельсин|лимон|виноград|клубник|малин|черник|арбуз|дыня|авокадо|гриб|лук\b|onion|перец|pepper|картоф|potato|салат|lettuce|зелень|овощ|фрукт|ягод|vegetable|fruit)/i;

export function looksLikeProduceName(name: string): boolean {
  const normalized = normalizeDishName(stripFreshnessAdjectives(name) || name);
  if (!normalized) return false;
  return normalized.split(" ").some((t) => PRODUCE_TOKEN.test(t));
}

/** Home staples that rarely have OFF packaging art — use Wiki/Commons (EN aliases help). */
export function looksLikeEggDishName(name: string): boolean {
  const normalized = normalizeDishName(name);
  if (!normalized) return false;
  if (/мешоч|яичниц|омлет|пашот|poached|глазун/.test(normalized)) return false;
  return /яйц/.test(normalized);
}

/** Prefer Wiki/Commons when OFF + packaging web miss (produce + boiled eggs, …). */
export function looksLikeWikiFoodFallbackName(name: string): boolean {
  return looksLikeProduceName(name) || looksLikeEggDishName(name);
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

  const stripped = stripFreshnessAdjectives(trimmed);
  const simplified = simplifyDishNameForLookup(stripped || trimmed);
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

  // Prefer stripped produce core before the full marketing phrase.
  if (stripped && normalizeDishName(stripped) !== normalizeDishName(trimmed)) {
    push(stripped);
  }

  for (const query of lookupQueriesForName(stripped || trimmed, simplified, limit)) {
    push(query);
  }
  // Also try original once (branded packs may need the full string).
  push(trimmed);

  if (looksLikeEggDishName(trimmed)) {
    push("hard-boiled egg");
    push("boiled egg");
    push("варёное яйцо");
  }

  const tokens = normalizeDishName(stripped || trimmed).split(" ").filter(Boolean);
  if (tokens.length >= 3) {
    push(tokens.slice(1).join(" "));
    push(tokens.slice(-2).join(" "));
  }
  if (tokens.length >= 2) {
    push(tokens.slice(-2).join(" "));
    const last = tokens[tokens.length - 1]!;
    if (last.length >= 5 && looksLikeFoodToken(last)) {
      push(last);
    }
    // Bare first produce token ("сельдерей").
    const first = tokens[0]!;
    if (first.length >= 4 && PRODUCE_TOKEN.test(first)) {
      push(first);
    }
  } else if (tokens.length === 1 && tokens[0]!.length >= 4) {
    push(tokens[0]!);
  }

  return out.slice(0, limit);
}

function looksLikeFoodToken(token: string): boolean {
  return /(каш|суп|борщ|салат|яйц|куриц|индейк|мяс|напит|сок|хлеб|пицц|паст|рис|греч|овсян|творог|йогурт|сыр|конфет|шоколад|батончик|печень|подушечк|варен|тушен|котлет|молоко|кефир|орех|фрукт|ягод|овощ|картоф|макарон|пельмен|блин|вафл|сельдере|celery|огурц|помидор|морков|капуст|candy|chocolate|yogurt|cheese|bread|soup|salad|chicken|turkey|porridge|pasta|pizza|snack|bar)/i.test(
    token,
  );
}
