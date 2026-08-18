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
  const pages = Object.values(data.query?.pages ?? {});
  const ranked = pages.sort((left, right) => (left.index ?? 99) - (right.index ?? 99));

  for (const page of ranked) {
    const title = page.title ?? "";
    const source = page.thumbnail?.source;
    if (!source || SKIP_TITLE.test(title) || SKIP_FILE.test(source)) {
      continue;
    }
    if (isAllowedImageUrl(source)) {
      return source;
    }
  }

  return undefined;
}

export function pickCommonsImage(data: CommonsQueryResponse): string | undefined {
  const pages = Object.values(data.query?.pages ?? {});
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
    if (source && isAllowedImageUrl(source) && !SKIP_FILE.test(source)) {
      return source;
    }
  }

  return undefined;
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
    pithumbsize: "480",
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
    iiurlwidth: "480",
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
  if (options.productImageUrl && isAllowedImageUrl(options.productImageUrl)) {
    return options.productImageUrl;
  }

  const query = options.query.trim();
  if (query.length < 2) {
    return undefined;
  }

  const stripped = withoutBrand(query, options.brand);
  const firstPass = await Promise.all([
    searchWikipediaImage(query, "ru"),
    searchWikipediaImage(query, "en"),
  ]);
  const immediate = firstPass.find(Boolean);
  if (immediate) {
    return immediate;
  }

  if (stripped) {
    const withoutBrandHit = await searchWikipediaImage(stripped, "ru");
    if (withoutBrandHit) {
      return withoutBrandHit;
    }
  }

  const dishQuery = `${stripped || query} блюдо`;
  const dishHit = await searchWikipediaImage(dishQuery, "ru");
  if (dishHit) {
    return dishHit;
  }

  return searchCommonsImage(stripped || query);
}
