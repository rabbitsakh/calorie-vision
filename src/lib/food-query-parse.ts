/**
 * Parse a typed food query into brand vs generic intent.
 * «творог обезжиренный» → generic average
 * «творог Простоквашино» → branded SKU search
 */

export type FoodQueryMode = "generic" | "branded";

export type ParsedFoodQuery = {
  raw: string;
  normalized: string;
  mode: FoodQueryMode;
  /** Product tokens without brand (e.g. «творог обезжиренный»). */
  product: string;
  brand: string | null;
  /** Explicit fat % values found in the query (e.g. 5, 0.5). */
  fatPercents: number[];
  /** True when the query is only a brand name (no product words). */
  brandOnly: boolean;
  /** Soft style flags for routing / matching. */
  flags: {
    fatFree: boolean;
    highProtein: boolean;
  };
};

/** Common RU dairy / grocery brands (normalized keys → display label). */
export const KNOWN_RU_BRANDS: Record<string, string> = {
  простоквашино: "Простоквашино",
  "домик в деревне": "Домик в деревне",
  домик: "Домик в деревне",
  вкуснотеево: "Вкуснотеево",
  активиа: "Активиа",
  activia: "Активиа",
  актимель: "Actimel",
  actimel: "Actimel",
  danone: "Danone",
  данон: "Danone",
  чудо: "Чудо",
  фругурт: "Фругурт",
  растишка: "Растишка",
  биомакс: "Биомакс",
  имунеле: "Имунеле",
  эпика: "Эпика",
  bombbar: "Bombbar",
  bobbbar: "Bombbar",
  бомббар: "Bombbar",
  боббар: "Bombbar",
  доширак: "Доширак",
  дошик: "Доширак",
  роллтон: "Роллтон",
  увелка: "Увелка",
  макфа: "Макфа",
  мираторг: "Мираторг",
  добрый: "Добрый",
  яшкино: "Яшкино",
  greenfield: "Greenfield",
  серышевский: "Серышевский",
  серышевская: "Серышевский",
  президент: "President",
  president: "President",
  valio: "Valio",
  валио: "Valio",
  савушкин: "Савушкин",
  "савушкин продукт": "Савушкин",
  nestle: "Nestlé",
  нестле: "Nestlé",
};

const FAT_FREE_RE = /обезжир|маложир|0\s*%|0[.,]\d+\s*%|fat\s*free|skim/i;
const HIGH_PROTEIN_RE = /протеин|protein|высокобелк/i;
const FAT_PERCENT_RE = /(\d+[.,]?\d*)\s*%/g;

/** Measure / filler tokens that are not a product name. */
const FILLER_TOKENS = new Set([
  "и",
  "с",
  "со",
  "в",
  "на",
  "из",
  "для",
  "без",
  "по",
  "the",
  "of",
]);

export function normalizeFoodQueryKey(value: string): string {
  return value
    .toLowerCase()
    .replace(/ё/g, "е")
    .replace(/[^a-zа-я0-9%.,]+/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function extractFatPercents(text: string): number[] {
  const out: number[] = [];
  for (const match of text.matchAll(FAT_PERCENT_RE)) {
    const n = Number.parseFloat((match[1] ?? "").replace(",", "."));
    if (Number.isFinite(n)) {
      out.push(n);
    }
  }
  return out;
}

/**
 * Find the longest known brand phrase in the normalized query.
 * Also treats a Latin token ≥3 chars as a brand when not a common English food word.
 */
function detectBrand(normalized: string): { brand: string; brandKey: string } | null {
  // Longest multi-word brand first
  const brandKeys = Object.keys(KNOWN_RU_BRANDS).sort((a, b) => b.length - a.length);
  for (const key of brandKeys) {
    const re = new RegExp(`(?:^|\\s)${key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?:\\s|$)`, "i");
    if (re.test(normalized)) {
      return { brand: KNOWN_RU_BRANDS[key]!, brandKey: key };
    }
  }

  // Latin brand-like token (Bobbbar, Nestle…) not already mapped
  const latin = normalized.match(/\b([a-z]{3,})\b/i);
  if (latin?.[1]) {
    const token = latin[1].toLowerCase();
    const englishFood = new Set([
      "milk",
      "yogurt",
      "cheese",
      "bread",
      "rice",
      "soup",
      "egg",
      "eggs",
      "chicken",
      "beef",
      "pork",
      "fish",
      "salad",
      "pasta",
      "pizza",
      "burger",
      "coffee",
      "tea",
      "juice",
      "protein",
      "greek",
      "natural",
      "free",
      "fat",
      "light",
    ]);
    if (!englishFood.has(token)) {
      const mapped = KNOWN_RU_BRANDS[token];
      return { brand: mapped ?? capitalizeBrand(latin[1]), brandKey: token };
    }
  }

  return null;
}

function capitalizeBrand(value: string): string {
  if (!value) return value;
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function stripBrandFromProduct(normalized: string, brandKey: string): string {
  const re = new RegExp(`(?:^|\\s)${brandKey.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?:\\s|$)`, "gi");
  return normalized
    .replace(re, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Build the product phrase used for generic / RU table lookup. */
export function productLookupPhrase(parsed: ParsedFoodQuery): string {
  const parts = [parsed.product];
  if (parsed.flags.fatFree && !/обезжир|0\s*%|0[.,]\d+/.test(parsed.product)) {
    parts.push("обезжиренный");
  }
  return parts.filter(Boolean).join(" ").trim() || parsed.normalized;
}

/** Build OFF / brand-search queries (brand + product permutations). */
export function brandedLookupQueries(parsed: ParsedFoodQuery, limit = 4): string[] {
  const out: string[] = [];
  const push = (value: string) => {
    const t = value.trim();
    if (t.length < 3) return;
    if (!out.some((x) => normalizeFoodQueryKey(x) === normalizeFoodQueryKey(t))) {
      out.push(t);
    }
  };

  push(parsed.raw);
  if (parsed.brand && parsed.product) {
    push(`${parsed.brand} ${parsed.product}`);
    push(`${parsed.product} ${parsed.brand}`);
  } else if (parsed.brand) {
    push(parsed.brand);
  }
  if (parsed.product) {
    push(parsed.product);
  }
  return out.slice(0, limit);
}

export function parseFoodQuery(rawInput: string): ParsedFoodQuery {
  const raw = rawInput.trim();
  const normalized = normalizeFoodQueryKey(raw);
  const fatPercents = extractFatPercents(raw);
  const flags = {
    fatFree: FAT_FREE_RE.test(raw) || fatPercents.some((f) => f <= 1),
    highProtein: HIGH_PROTEIN_RE.test(raw),
  };

  const detected = detectBrand(normalized);
  if (detected) {
    const product = stripBrandFromProduct(normalized, detected.brandKey)
      .split(" ")
      .filter((t) => t && !FILLER_TOKENS.has(t))
      .join(" ")
      .trim();

    const brandOnly = !product || product.replace(/[\d%.,]+/g, "").trim().length === 0;

    return {
      raw,
      normalized,
      mode: "branded",
      product: brandOnly ? "" : product,
      brand: detected.brand,
      fatPercents,
      brandOnly,
      flags,
    };
  }

  // No brand — generic average path (even for «творог 5%» / «творог обезжиренный»).
  const product = normalized
    .split(" ")
    .filter((t) => t && !FILLER_TOKENS.has(t))
    .join(" ")
    .trim();

  return {
    raw,
    normalized,
    mode: "generic",
    product: product || normalized,
    brand: null,
    fatPercents,
    brandOnly: false,
    flags,
  };
}
