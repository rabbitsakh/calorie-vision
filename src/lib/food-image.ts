const USER_AGENT = "CalorieVision/1.0 (https://calorievision.ru; food image lookup)";
const WIKI_TIMEOUT_MS = 8000;

const SKIP_TITLE =
  /(значения|список|категория|дизамбиг|disambiguation|list of|category:|flag of|coat of arms)/i;
const SKIP_FILE = /(flag|map|logo|icon|svg|diagram|chart|coat_of_arms|wordmark)/i;

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
    if (!source || SKIP_TITLE.test(title) || SKIP_FILE.test(source)) {
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
    if (SKIP_TITLE.test(title) || SKIP_FILE.test(title)) {
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
    if (source && isAllowedImageUrl(source) && !SKIP_FILE.test(source) && !urls.includes(source)) {
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

async function searchWikipediaImage(query: string, lang: "ru" | "en"): Promise<string | undefined> {
  const trimmed = query.trim();
  if (trimmed.length < 2) {
    return undefined;
  }

  const url = `https://${lang}.wikipedia.org/w/api.php?${new URLSearchParams({
    action: "query",
    format: "json",
    origin: "*",
    generator: "search",
    gsrsearch: trimmed,
    gsrlimit: "5",
    gsrnamespace: "0",
    prop: "pageimages",
    piprop: "thumbnail",
    pithumbsize: "640",
    pilicense: "any",
  }).toString()}`;

  const data = (await getJson(url)) as WikiQueryResponse | null;
  if (!data) {
    return undefined;
  }

  return pickWikipediaThumbnail(data);
}

async function searchCommonsImage(query: string): Promise<string | undefined> {
  const trimmed = query.trim();
  if (trimmed.length < 2) {
    return undefined;
  }

  const url = `https://commons.wikimedia.org/w/api.php?${new URLSearchParams({
    action: "query",
    format: "json",
    origin: "*",
    generator: "search",
    gsrsearch: `${trimmed} food`,
    gsrlimit: "8",
    gsrnamespace: "6",
    prop: "imageinfo",
    iiprop: "url|mime|size",
    iiurlwidth: "640",
  }).toString()}`;

  const data = (await getJson(url)) as CommonsQueryResponse | null;
  if (!data) {
    return undefined;
  }

  return pickCommonsImage(data);
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

export async function findFoodImage(options: {
  query: string;
  brand?: string;
  productImageUrl?: string;
}): Promise<string | undefined> {
  const candidates = await searchFoodImageCandidates(options.query, {
    brand: options.brand,
    productImageUrl: options.productImageUrl,
    limit: 1,
  });
  return candidates[0]?.url;
}

export type FoodImageCandidate = {
  url: string;
  source: "openfoodfacts" | "wikipedia" | "commons";
  label?: string;
};

/** Collect several safe HTTPS candidates for a dish photo picker. */
export async function searchFoodImageCandidates(
  rawQuery: string,
  options?: { brand?: string; productImageUrl?: string; limit?: number },
): Promise<FoodImageCandidate[]> {
  const limit = options?.limit ?? 8;
  const query = rawQuery.trim();
  const out: FoodImageCandidate[] = [];
  const seen = new Set<string>();

  const push = (url: string | undefined, source: FoodImageCandidate["source"], label?: string) => {
    if (!url || !isAllowedImageUrl(url) || seen.has(url) || out.length >= limit) {
      return;
    }
    seen.add(url);
    out.push({ url, source, label });
  };

  if (options?.productImageUrl) {
    push(options.productImageUrl, "openfoodfacts", "Open Food Facts");
  }

  if (query.length < 2) {
    return out;
  }

  const stripped = withoutBrand(query, options?.brand);
  const wikiQueries = [query, stripped, `${stripped || query} блюдо`, `${stripped || query} food`].filter(
    (value): value is string => Boolean(value && value.trim().length >= 2),
  );

  const [wikiRu, wikiEn, commons] = await Promise.all([
    Promise.all(wikiQueries.slice(0, 2).map((q) => searchWikipediaImageList(q, "ru", 4))),
    Promise.all(wikiQueries.slice(0, 2).map((q) => searchWikipediaImageList(q, "en", 3))),
    searchCommonsImageList(stripped || query, 4),
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
    gsrsearch: `${trimmed} food`,
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
