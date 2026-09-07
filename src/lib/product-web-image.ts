/**
 * Product image fallback via DuckDuckGo Images when Open Food Facts has no photo.
 * Always bias queries toward packaging / product; filter people & costumes.
 */

const USER_AGENT =
  "CalorieVision/1.0 (https://calorievision.ru; product image search)";
const TIMEOUT_MS = 9000;

const REJECT_HIT =
  /(portrait|self[-_]?portrait|person|people|actor|actress|биограф|costume|carnival|маскарад|карнавал|фильм|film|кино|comic|супергерой|statue|sculpture|painting|drawing|meme|screenshot|wiki\s*commons)/i;

const VQD_RE = /vqd=['"]([^'"]+)['"]/i;

export type ProductWebImageHit = {
  url: string;
  title: string;
  thumbnail?: string;
};

/** Food/product-biased search strings for web image lookup. */
export function buildProductWebImageQueries(dishName: string, brand?: string): string[] {
  const name = dishName.trim().replace(/\s+/g, " ");
  if (name.length < 2) return [];

  const out: string[] = [];
  const push = (q: string) => {
    const next = q.trim().replace(/\s+/g, " ");
    if (next.length < 3) return;
    if (out.some((x) => x.toLowerCase() === next.toLowerCase())) return;
    out.push(next);
  };

  push(`${name} упаковка`);
  push(`${name} продукт`);
  push(`${name} купить`);
  push(`${name} packaging`);
  if (brand?.trim()) {
    push(`${brand.trim()} ${name} упаковка`);
  }

  return out.slice(0, 4);
}

export function isRejectedWebImageHit(title: string, url: string): boolean {
  const hay = `${title} ${url}`;
  return REJECT_HIT.test(hay);
}

/** HTTPS product CDN URLs we may download (not hotlink into the diary). */
export function isDownloadableProductImageUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "https:") return false;
    const host = parsed.hostname.toLowerCase();
    if (
      host === "localhost" ||
      host === "127.0.0.1" ||
      host === "0.0.0.0" ||
      host === "::1" ||
      host.endsWith(".local") ||
      host.endsWith(".internal") ||
      /^(10\.|192\.168\.|172\.(1[6-9]|2\d|3[0-1])\.|169\.254\.)/.test(host) ||
      host === "metadata.google.internal"
    ) {
      return false;
    }
    // Skip obvious non-images / trackers
    if (/\.(svg)(\?|$)/i.test(parsed.pathname)) return false;
    return true;
  } catch {
    return false;
  }
}

async function fetchText(url: string, init?: RequestInit): Promise<string | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const response = await fetch(url, {
      ...init,
      signal: controller.signal,
      headers: {
        "User-Agent": USER_AGENT,
        Accept: "text/html,application/json,*/*",
        ...(init?.headers ?? {}),
      },
      redirect: "follow",
    });
    if (!response.ok) return null;
    return await response.text();
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

async function resolveVqd(query: string): Promise<string | null> {
  const html = await fetchText(
    `https://duckduckgo.com/?${new URLSearchParams({ q: query, ia: "images", iax: "images" }).toString()}`,
  );
  if (!html) return null;
  const match = VQD_RE.exec(html);
  return match?.[1] ?? null;
}

type DdgImageResult = {
  image?: string;
  thumbnail?: string;
  title?: string;
  url?: string;
};

function parseDdgImageJson(body: string): ProductWebImageHit[] {
  try {
    const data = JSON.parse(body) as { results?: DdgImageResult[] };
    const hits: ProductWebImageHit[] = [];
    for (const row of data.results ?? []) {
      const imageUrl = (row.image || row.thumbnail || "").trim();
      const title = (row.title || "").trim();
      if (!imageUrl || !isDownloadableProductImageUrl(imageUrl)) continue;
      if (isRejectedWebImageHit(title, imageUrl)) continue;
      hits.push({
        url: imageUrl,
        title: title || "product",
        thumbnail: row.thumbnail,
      });
    }
    return hits;
  } catch {
    return [];
  }
}

async function searchDdgImagesOnce(query: string, limit: number): Promise<ProductWebImageHit[]> {
  const vqd = await resolveVqd(query);
  if (!vqd) return [];

  const url = `https://duckduckgo.com/i.js?${new URLSearchParams({
    l: "ru-ru",
    o: "json",
    q: query,
    vqd,
    f: ",,,",
    p: "1",
  }).toString()}`;

  const body = await fetchText(url, {
    headers: {
      Referer: "https://duckduckgo.com/",
      Accept: "application/json",
    },
  });
  if (!body) return [];
  return parseDdgImageJson(body).slice(0, limit);
}

/**
 * Search the web for product packaging photos.
 * Returns remote HTTPS image URLs (caller must cache via allowWebProduct).
 */
export async function searchProductWebImages(
  dishName: string,
  options?: { brand?: string; limit?: number },
): Promise<ProductWebImageHit[]> {
  const limit = options?.limit ?? 6;
  const queries = buildProductWebImageQueries(dishName, options?.brand);
  if (queries.length === 0) return [];

  const out: ProductWebImageHit[] = [];
  const seen = new Set<string>();

  for (const query of queries.slice(0, 2)) {
    const hits = await searchDdgImagesOnce(query, limit);
    for (const hit of hits) {
      if (seen.has(hit.url)) continue;
      seen.add(hit.url);
      out.push(hit);
      if (out.length >= limit) return out;
    }
  }

  return out;
}
