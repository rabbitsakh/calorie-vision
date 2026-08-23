/**
 * Internet evidence for barcodes missing from Open Food Facts.
 * Feeds titles/snippets into GigaChat so the model is not guessing from memory alone.
 */

export type BarcodeWebEvidence = {
  titles: string[];
  brand?: string;
  snippets: string[];
  sources: string[];
};

const FETCH_MS = 7_000;
const USER_AGENT =
  "CalorieVision/1.0 (https://calorievision.ru; barcode product lookup)";

/** Generic barcode tools / calorie calculators — not product names. */
const JUNK_TITLE_PATTERNS = [
  /barcode lookup/i,
  /barcode search/i,
  /upc.*search/i,
  /ean.*search/i,
  /gtin/i,
  /калькулятор/i,
  /таблица калор/i,
  /таблица продукт/i,
  /проверк[аи] штрих/i,
  /parcel tracking/i,
  /invalid value/i,
  /go-upc$/i,
  /retailerapi/i,
  /barcodereport/i,
  /ean-search/i,
  /упаковк.*штрих/i,
  /tablicakalor/i,
  /customer support/i,
  /identify your product/i,
  /oral supplement ensure/i,
];

export function isJunkBarcodeWebTitle(title: string): boolean {
  const normalized = title.trim();
  if (!normalized || normalized.length < 3) {
    return true;
  }
  return JUNK_TITLE_PATTERNS.some((pattern) => pattern.test(normalized));
}

async function fetchText(url: string, init?: RequestInit): Promise<string | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_MS);
  try {
    const response = await fetch(url, {
      ...init,
      signal: controller.signal,
      headers: {
        "User-Agent": USER_AGENT,
        Accept: "text/html,application/json,*/*",
        ...(init?.headers ?? {}),
      },
    });
    if (!response.ok) {
      return null;
    }
    return await response.text();
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

async function fetchJson<T>(url: string): Promise<T | null> {
  const text = await fetchText(url, { headers: { Accept: "application/json" } });
  if (!text) {
    return null;
  }
  try {
    return JSON.parse(text) as T;
  } catch {
    return null;
  }
}

function decodeHtml(value: string): string {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#x27;/g, "'")
    .replace(/&#(\d+);/g, (_, n: string) => String.fromCharCode(Number(n)));
}

function cleanTitle(raw: string): string | null {
  const title = decodeHtml(raw)
    .replace(/\s+/g, " ")
    .replace(/\|\s*.+$/, "")
    .replace(/\s+[—–-]\s+(Ozon|Wildberries|Яндекс|Wikipedia|Amazon|Go-UPC).*$/i, "")
    .trim();
  if (title.length < 3 || title.length > 160) {
    return null;
  }
  // Skip pure digit / barcode-only hits.
  if (/^\d{8,14}$/.test(title)) {
    return null;
  }
  if (isJunkBarcodeWebTitle(title)) {
    return null;
  }
  return title;
}

function looksLikeProductTitle(title: string): boolean {
  return /(?:\d[\d.,]*\s*(?:г|гр|ml|мл|л|l)\b|\d[\d.,]*\s*%|1\/\d+)/i.test(title);
}

async function lookupUpcItemDb(barcode: string): Promise<Partial<BarcodeWebEvidence>> {
  const data = await fetchJson<{
    items?: Array<{ title?: string; brand?: string; description?: string }>;
  }>(`https://api.upcitemdb.com/prod/trial/lookup?upc=${encodeURIComponent(barcode)}`);

  const item = data?.items?.[0];
  if (!item?.title) {
    return {};
  }
  const title = cleanTitle(item.title);
  return {
    titles: title ? [title] : [],
    brand: item.brand?.trim() || undefined,
    snippets: item.description ? [item.description.slice(0, 280)] : [],
    sources: title ? ["upcitemdb"] : [],
  };
}

/** Go-UPC search — strong for import / CN / US barcodes missing from OFF. */
async function lookupGoUpc(barcode: string): Promise<Partial<BarcodeWebEvidence>> {
  const html = await fetchText(
    `https://go-upc.com/search?q=${encodeURIComponent(barcode)}`,
  );
  if (!html) {
    return {};
  }

  const pageTitle = html.match(/<title>([^<]+)/i)?.[1]?.trim() ?? "";
  if (/invalid value/i.test(pageTitle)) {
    return {};
  }

  const h1Raw = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i)?.[1];
  const h1 = h1Raw ? cleanTitle(h1Raw.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim()) : null;

  let titleFromTag: string | null = null;
  if (pageTitle.includes(barcode)) {
    titleFromTag = cleanTitle(pageTitle.split("—")[0]?.trim() ?? "");
  }

  const productTitle = h1 ?? titleFromTag;
  if (!productTitle) {
    return {};
  }

  const descMatch = html.match(/Description\s*<\/h2>\s*<span>\s*([\s\S]*?)<\/span>/i);
  const snippet = descMatch
    ? decodeHtml(descMatch[1].replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim())
    : null;

  const brand = /(?:Harbin|Харбин)/i.test(productTitle)
    ? "Harbin"
    : snippet?.match(/\/([A-Za-z][A-Za-z .'-]{2,20})(?:\s|$|\*)/)?.[1]?.trim();

  return {
    titles: [productTitle],
    brand,
    snippets: snippet ? [snippet.slice(0, 280)] : [],
    sources: ["go-upc"],
  };
}

function parseDuckDuckGoHtml(html: string): Partial<BarcodeWebEvidence> {
  const titles: string[] = [];
  const snippets: string[] = [];

  const linkRe = /<a[^>]*rel="nofollow"[^>]*>([^<]{3,160})<\/a>/gi;
  let match: RegExpExecArray | null;
  while ((match = linkRe.exec(html)) !== null && titles.length < 8) {
    const title = cleanTitle(match[1] ?? "");
    if (title && !titles.includes(title)) {
      titles.push(title);
    }
  }

  const snipRe = /class="result-snippet"[^>]*>([\s\S]*?)<\/td>/gi;
  while ((match = snipRe.exec(html)) !== null && snippets.length < 4) {
    const snip = decodeHtml(match[1] ?? "")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim();
    if (snip.length > 20 && !isJunkBarcodeWebTitle(snip)) {
      snippets.push(snip.slice(0, 220));
    }
  }

  return {
    titles,
    snippets,
    sources: titles.length || snippets.length ? ["duckduckgo"] : [],
  };
}

/** DuckDuckGo Lite — multiple queries; filter generic barcode/calorie sites. */
async function lookupDuckDuckGo(barcode: string): Promise<Partial<BarcodeWebEvidence>> {
  const queries = [
    `"${barcode}" купить`,
    `${barcode} product name`,
    `${barcode} состав калории`,
  ];

  const pages = await Promise.all(
    queries.map((query) =>
      fetchText(`https://lite.duckduckgo.com/lite/?q=${encodeURIComponent(query)}`),
    ),
  );

  const parts = pages.filter(Boolean).map((html) => parseDuckDuckGoHtml(html!));
  return mergeEvidence(parts);
}

function mergeEvidence(parts: Array<Partial<BarcodeWebEvidence>>): BarcodeWebEvidence {
  const titles: string[] = [];
  const snippets: string[] = [];
  const sources: string[] = [];
  let brand: string | undefined;

  for (const part of parts) {
    for (const title of part.titles ?? []) {
      if (!titles.includes(title)) {
        titles.push(title);
      }
    }
    for (const snip of part.snippets ?? []) {
      if (!snippets.includes(snip)) {
        snippets.push(snip);
      }
    }
    for (const source of part.sources ?? []) {
      if (!sources.includes(source)) {
        sources.push(source);
      }
    }
    if (!brand && part.brand) {
      brand = part.brand;
    }
  }

  return {
    titles: titles.slice(0, 8),
    brand,
    snippets: snippets.slice(0, 6),
    sources,
  };
}

/** Parallel web lookups for an EAN missing from Open Food Facts. */
export async function gatherBarcodeWebEvidence(barcode: string): Promise<BarcodeWebEvidence> {
  const code = barcode.trim();
  if (!/^\d{8,14}$/.test(code)) {
    return { titles: [], snippets: [], sources: [] };
  }

  const parts = await Promise.all([
    lookupGoUpc(code),
    lookupUpcItemDb(code),
    lookupDuckDuckGo(code),
  ]);
  return mergeEvidence(parts);
}

/** Compact block for the GigaChat barcode prompt. */
export function formatBarcodeWebContext(evidence: BarcodeWebEvidence): string {
  if (!evidence.titles.length && !evidence.snippets.length) {
    return "";
  }

  const lines: string[] = ["Данные из интернета по этому штрихкоду (используй как подсказки, не копируй мусор):"];
  if (evidence.brand) {
    lines.push(`- brand hint: ${evidence.brand}`);
  }
  evidence.titles.slice(0, 5).forEach((title, index) => {
    lines.push(`- title ${index + 1}: ${title}`);
  });
  evidence.snippets.slice(0, 3).forEach((snip, index) => {
    lines.push(`- snippet ${index + 1}: ${snip}`);
  });
  if (evidence.sources.length) {
    lines.push(`- sources: ${evidence.sources.join(", ")}`);
  }
  return lines.join("\n");
}

/** Normalize marketplace / case-pack noise from a web product title. */
export function normalizeBarcodeWebProductName(title: string): string {
  return title
    .replace(/\s*1\/\d+\s*$/i, "")
    .replace(/\s+\d+\s*г\.?$/i, "")
    .replace(/\s+\d+\s*мл\.?$/i, "")
    .replace(/\s*[—–-]\s*EAN\s+\d+.*$/i, "")
    .trim();
}

/** Best product name guess from web titles (for OFF / RU name search). */
export function pickBarcodeWebProductName(evidence: BarcodeWebEvidence): string | null {
  const candidates = evidence.titles.filter((title) => !isJunkBarcodeWebTitle(title));
  if (!candidates.length) {
    return null;
  }

  const preferred =
    candidates.find((title) => /[а-яё]/i.test(title) && looksLikeProductTitle(title)) ??
    candidates.find((title) => /[а-яё]/i.test(title)) ??
    candidates.find((title) => looksLikeProductTitle(title)) ??
    candidates.find((title) => /ккал|белк|жир|углевод|состав/i.test(title)) ??
    candidates[0];

  const normalized = normalizeBarcodeWebProductName(preferred);
  return normalized || null;
}

/** True when go-upc or upcitemdb returned a concrete product title. */
export function hasTrustedBarcodeWebName(evidence: BarcodeWebEvidence): boolean {
  return evidence.sources.some((source) => source === "go-upc" || source === "upcitemdb");
}
