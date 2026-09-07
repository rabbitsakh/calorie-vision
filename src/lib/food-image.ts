const USER_AGENT = "CalorieVision/1.0 (https://calorievision.ru; food image lookup)";
const WIKI_TIMEOUT_MS = 8000;

/** Disambiguation / non-food Wikipedia titles. */
export const SKIP_WIKI_TITLE =
  /(значения|список|категория|дизамбиг|disambiguation|list of|category:|flag of|coat of arms|биограф|biography|акт[её]р|actress|actor|персона|person\b|фильм|filmography|\bfilm\b|кино|маскарад|карнавал|костюм|costume|портрет|portrait|художник|painter|писатель|writer|политик|учёный|ученый|scientist|музыкант|musician|спортсмен|athlete|футболист|маска\b|mask\b|супергерой|superhero|комикс|comic)/i;

/** File names that are almost never product photos. */
export const SKIP_IMAGE_FILE =
  /(flag|map|logo|icon|svg|diagram|chart|coat_of_arms|wordmark|portrait|self[-_]?portrait|costume|carnival|mask_|_mask|actor|actress|person|people|statue|sculpture|painting|drawing)/i;

type WikiThumbnailPage = {
  pageid?: number;
  index?: number;
  title?: string;
  thumbnail?: { source?: string };
};

type WikiQueryResponse = {
  query?: {
    pages?: Record<string, WikiThumbnailPage>;
  };
};

type CommonsImageInfo = {
  mime?: string;
  thumburl?: string;
  url?: string;
};

type CommonsPage = {
  title?: string;
  imageinfo?: CommonsImageInfo[];
};

type CommonsQueryResponse = {
  query?: {
    pages?: Record<string, CommonsPage>;
  };
};

export function isAllowedImageUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "https:") {
      return false;
    }

    const host = parsed.hostname.toLowerCase();
    return (
      host === "upload.wikimedia.org" ||
      host === "commons.wikimedia.org" ||
      host === "openfoodfacts.org" ||
      host === "static.openfoodfacts.org" ||
      host.endsWith(".openfoodfacts.org") ||
      host.endsWith(".openfoodfacts.net")
    );
  } catch {
    return false;
  }
}

export function isRejectedWikiTitle(title: string): boolean {
  return SKIP_WIKI_TITLE.test(title.trim());
}

/** True when a short bare token is likely a brand / ambiguous name, not a dish. */
export function isAmbiguousBareImageQuery(query: string): boolean {
  const tokens = query
    .trim()
    .toLowerCase()
    .replace(/ё/g, "е")
    .split(/[^a-zа-я0-9]+/i)
    .filter(Boolean);
  if (tokens.length === 0) return true;
  if (tokens.length >= 3) return false;
  if (tokens.length === 1) {
    const t = tokens[0]!;
    if (looksLikeFoodToken(t)) return false;
    // Single food words are ok (борщ, овсянка); short Latin brands are not.
    if (/^[a-z0-9]+$/i.test(t) && t.length <= 12) return true;
    if (t.length <= 5) return true;
    return true;
  }
  // Two tokens: still ambiguous if neither looks like food ("energy bombbar").
  return !tokens.some((t) => looksLikeFoodToken(t));
}

const FOOD_TOKEN =
  /(каш[аеи]|суп|борщ|щи\b|салат|яйц|куриц|индейк|говяд|свин|рыб|мяс|напит|сок\b|хлеб|пицц|паст|рис\b|греч|овсян|творог|йогурт|сыр\b|конфет|шоколад|батончик|печень|варен|тушен|жарен|запеч|котлет|сосиск|колбас|молоко|кефир|сметан|масло|орех|фрукт|ягод|овощ|картоф|макарон|лапш|пельмен|блин|вафл|пудинг|протеин|energy|drink|candy|chocolate|yogurt|cheese|bread|soup|salad|chicken|turkey|porridge|oatmeal|buckwheat|pasta|pizza|meal|food|product|dish|snack|(?:^|[^a-zа-я])bars?(?:[^a-zа-я]|$))/i;

export function looksLikeFoodToken(token: string): boolean {
  return FOOD_TOKEN.test(token);
}

/**
 * Wikipedia/Commons queries: always bias toward food/product pages.
 * Bare brand names ("Маска", "Bombbar") are never searched as-is.
 */
export function buildFoodImageWikiQueries(query: string, brand?: string): string[] {
  const base = query.trim();
  if (base.length < 2) return [];

  const stripped = withoutBrand(base, brand);
  const core = (stripped && stripped.length >= 3 ? stripped : base).trim();
  const out: string[] = [];
  const push = (value: string) => {
    const next = value.trim().replace(/\s+/g, " ");
    if (next.length < 3) return;
    if (out.some((q) => q.toLowerCase() === next.toLowerCase())) return;
    out.push(next);
  };

  // Prefer food-context forms first.
  push(`${core} продукт`);
  push(`${core} еда`);
  push(`${core} упаковка`);
  push(`${core} блюдо`);
  push(`${core} food`);
  push(`${core} food product`);

  if (brand?.trim() && core.toLowerCase() !== brand.trim().toLowerCase()) {
    push(`${brand.trim()} ${core} продукт`);
  }

  // Only allow unsuffixed core when it already looks like a dish description.
  if (!isAmbiguousBareImageQuery(core)) {
    push(core);
  }

  return out.slice(0, 6);
}

export function pickWikipediaThumbnail(data: WikiQueryResponse): string | undefined {
  return listWikipediaThumbnails(data, 1)[0];
}

export function listWikipediaThumbnails(data: WikiQueryResponse, limit = 6): string[] {
  const pages = Object.values(data.query?.pages ?? {});
  const ranked = pages.sort((left, right) => (left.index ?? 99) - (right.index ?? 99));
  const urls: string[] = [];

  for (const page of ranked) {
    const title = page.title ?? "";
    const source = page.thumbnail?.source;
    if (!source || isRejectedWikiTitle(title) || SKIP_IMAGE_FILE.test(source)) {
      continue;
    }
    if (isAllowedImageUrl(source) && !urls.includes(source)) {
      urls.push(source);
    }
    if (urls.length >= limit) {
      break;
    }
  }

  return urls;
}

export function pickCommonsImage(data: CommonsQueryResponse): string | undefined {
  return listCommonsImages(data, 1)[0];
}

export function listCommonsImages(data: CommonsQueryResponse, limit = 6): string[] {
  const pages = Object.values(data.query?.pages ?? {});
  const urls: string[] = [];

  for (const page of pages) {
    const title = page.title ?? "";
    if (isRejectedWikiTitle(title) || SKIP_IMAGE_FILE.test(title)) {
      continue;
    }

    const info = page.imageinfo?.[0];
    const mime = info?.mime ?? "";
    if (mime && !mime.startsWith("image/")) {
      continue;
    }
    if (mime === "image/svg+xml") {
      continue;
    }

    const source = info?.thumburl || info?.url;
    if (
      source &&
      isAllowedImageUrl(source) &&
      !SKIP_IMAGE_FILE.test(source) &&
      !urls.includes(source)
    ) {
      urls.push(source);
    }
    if (urls.length >= limit) {
      break;
    }
  }

  return urls;
}

async function getJson(url: string): Promise<unknown | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), WIKI_TIMEOUT_MS);
  try {
    const response = await fetch(url, {
      headers: {
        "User-Agent": USER_AGENT,
        Accept: "application/json",
      },
      signal: controller.signal,
    });
    if (!response.ok) {
      return null;
    }
    return (await response.json()) as unknown;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

function withoutBrand(query: string, brand?: string): string | undefined {
  if (!brand) {
    return undefined;
  }

  const brandPrefix = brand.trim();
  if (!brandPrefix) {
    return undefined;
  }

  const pattern = new RegExp(`^${brandPrefix.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s+`, "i");
  const stripped = query.replace(pattern, "").trim();
  return stripped.length >= 3 && stripped.toLowerCase() !== query.toLowerCase() ? stripped : undefined;
}

export type FoodImageSearchMode = "auto" | "picker";

export async function findFoodImage(options: {
  query: string;
  brand?: string;
  productImageUrl?: string;
  /**
   * auto (default): OFF product image, then web packaging search (cached by caller).
   * Never uses bare Wikipedia brand pages.
   */
  mode?: FoodImageSearchMode;
}): Promise<string | undefined> {
  const mode = options.mode ?? "auto";
  const off = options.productImageUrl?.trim();
  if (off && isAllowedImageUrl(off)) {
    return off;
  }

  if (mode === "auto") {
    // Web hits are remote URLs — caller (backfill / lookup) caches with allowWebProduct.
    const { searchProductWebImages } = await import("@/lib/product-web-image");
    const hits = await searchProductWebImages(options.query, {
      brand: options.brand,
      limit: 4,
    });
    return hits[0]?.url;
  }

  const candidates = await searchFoodImageCandidates(options.query, {
    brand: options.brand,
    productImageUrl: options.productImageUrl,
    limit: 1,
    mode: "picker",
  });
  return candidates[0]?.url;
}

export type FoodImageCandidate = {
  url: string;
  source: "openfoodfacts" | "wikipedia" | "commons" | "web";
  label?: string;
};

/** Collect several safe HTTPS candidates for a dish photo picker. */
export async function searchFoodImageCandidates(
  rawQuery: string,
  options?: {
    brand?: string;
    productImageUrl?: string;
    limit?: number;
    mode?: FoodImageSearchMode;
  },
): Promise<FoodImageCandidate[]> {
  const limit = options?.limit ?? 8;
  const mode = options?.mode ?? "picker";
  const query = rawQuery.trim();
  const out: FoodImageCandidate[] = [];
  const seen = new Set<string>();

  const push = (
    url: string | undefined,
    source: FoodImageCandidate["source"],
    label?: string,
    /** Web product URLs bypass catalog allowlist (download-only). */
    allowWeb?: boolean,
  ) => {
    if (!url || seen.has(url) || out.length >= limit) {
      return;
    }
    if (source === "web" || allowWeb) {
      // Defer host check to download step; still require https shape here via caller.
      if (!/^https:\/\//i.test(url)) return;
    } else if (!isAllowedImageUrl(url)) {
      return;
    }
    seen.add(url);
    out.push({ url, source, label });
  };

  if (options?.productImageUrl) {
    push(options.productImageUrl, "openfoodfacts", "Open Food Facts");
  }

  // Web packaging search for both auto attach and picker.
  if (query.length >= 2) {
    const { searchProductWebImages } = await import("@/lib/product-web-image");
    const webHits = await searchProductWebImages(query, {
      brand: options?.brand,
      limit: mode === "auto" ? Math.min(4, limit) : Math.min(6, limit),
    });
    for (const hit of webHits) {
      push(hit.url, "web", "Интернет", true);
    }
  }

  if (mode === "auto") {
    return out.slice(0, limit);
  }

  if (query.length < 2) {
    return out;
  }

  const wikiQueries = buildFoodImageWikiQueries(query, options?.brand);
  if (wikiQueries.length === 0) {
    return out.slice(0, limit);
  }

  // Search food-biased queries (not bare brand). Cap parallel calls.
  const searchQs = wikiQueries.slice(0, 3);
  const commonsSeed =
    wikiQueries.find((q) => /продукт|еда|food|блюдо|упаковка/i.test(q)) ?? wikiQueries[0]!;

  const [wikiRu, wikiEn, commons] = await Promise.all([
    Promise.all(searchQs.map((q) => searchWikipediaImageList(q, "ru", 4))),
    Promise.all(searchQs.slice(0, 2).map((q) => searchWikipediaImageList(q, "en", 3))),
    searchCommonsImageList(
      commonsSeed.replace(/\s+(продукт|еда|упаковка|блюдо|food|product)$/i, "").trim() || query,
      4,
    ),
  ]);

  for (const urls of wikiRu) {
    for (const url of urls) {
      push(url, "wikipedia", "Wikipedia");
    }
  }
  for (const urls of wikiEn) {
    for (const url of urls) {
      push(url, "wikipedia", "Wikipedia");
    }
  }
  for (const url of commons) {
    push(url, "commons", "Wikimedia Commons");
  }

  return out.slice(0, limit);
}

async function searchWikipediaImageList(
  query: string,
  lang: "ru" | "en",
  limit: number,
): Promise<string[]> {
  const trimmed = query.trim();
  if (trimmed.length < 2) {
    return [];
  }

  const url = `https://${lang}.wikipedia.org/w/api.php?${new URLSearchParams({
    action: "query",
    format: "json",
    origin: "*",
    generator: "search",
    gsrsearch: trimmed,
    gsrlimit: String(Math.max(5, limit)),
    gsrnamespace: "0",
    prop: "pageimages",
    piprop: "thumbnail",
    pithumbsize: "640",
    pilicense: "any",
  }).toString()}`;

  const data = (await getJson(url)) as WikiQueryResponse | null;
  if (!data) {
    return [];
  }

  return listWikipediaThumbnails(data, limit);
}

async function searchCommonsImageList(query: string, limit: number): Promise<string[]> {
  const trimmed = query.trim();
  if (trimmed.length < 2) {
    return [];
  }

  const url = `https://commons.wikimedia.org/w/api.php?${new URLSearchParams({
    action: "query",
    format: "json",
    origin: "*",
    generator: "search",
    gsrsearch: `${trimmed} food product`,
    gsrlimit: String(Math.max(8, limit)),
    gsrnamespace: "6",
    prop: "imageinfo",
    iiprop: "url|mime|size",
    iiurlwidth: "640",
  }).toString()}`;

  const data = (await getJson(url)) as CommonsQueryResponse | null;
  if (!data) {
    return [];
  }

  return listCommonsImages(data, limit);
}
