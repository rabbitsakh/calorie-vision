/** Рекламные метки. Первое касание не затирается более поздним заходом. */

export const SIGNUP_ATTRIBUTION_KEY = "cv-signup-attribution";

export const UTM_KEYS = [
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_content",
  "utm_term",
] as const;

export type UtmKey = (typeof UTM_KEYS)[number];
export type SignupAttribution = Partial<Record<UtmKey, string>>;

const MAX_LEN = 120;

function cleanUtmValue(value: string): string | null {
  if (/[\u0000-\u001f]/.test(value)) return null;
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > MAX_LEN) return null;
  return trimmed;
}

export function parseSignupAttribution(params: URLSearchParams): SignupAttribution | null {
  const out: SignupAttribution = {};
  for (const key of UTM_KEYS) {
    const value = cleanUtmValue(params.get(key) ?? "");
    if (value) out[key] = value;
  }
  return Object.keys(out).length > 0 ? out : null;
}

export function attributionFromSearch(search: string): SignupAttribution | null {
  const query = search.startsWith("?") ? search.slice(1) : search;
  return parseSignupAttribution(new URLSearchParams(query));
}

export function parseSignupAttributionBody(value: unknown): SignupAttribution | null {
  if (!value || typeof value !== "object") return null;
  const params = new URLSearchParams();
  for (const key of UTM_KEYS) {
    const raw = (value as Record<string, unknown>)[key];
    if (typeof raw === "string") params.set(key, raw);
  }
  return parseSignupAttribution(params);
}

/** Уже сохранённый источник важнее новых меток в адресе. */
export function mergeFirstTouch(
  stored: SignupAttribution | null,
  incoming: SignupAttribution | null,
): SignupAttribution | null {
  if (stored && Object.keys(stored).length > 0) return stored;
  return incoming;
}

export function readStoredAttribution(storage: Pick<Storage, "getItem"> | null): SignupAttribution | null {
  if (!storage) return null;
  try {
    const raw = storage.getItem(SIGNUP_ATTRIBUTION_KEY);
    if (!raw) return null;
    return parseSignupAttributionBody(JSON.parse(raw) as unknown);
  } catch {
    return null;
  }
}

export function writeStoredAttribution(
  storage: Pick<Storage, "setItem"> | null,
  value: SignupAttribution | null,
): void {
  if (!storage || !value) return;
  try {
    storage.setItem(SIGNUP_ATTRIBUTION_KEY, JSON.stringify(value));
  } catch {
    // ignore
  }
}

export function hrefWithAttribution(path: string, attribution: SignupAttribution | null): string {
  if (!attribution) return path;
  const hashIndex = path.indexOf("#");
  const hash = hashIndex >= 0 ? path.slice(hashIndex) : "";
  const withoutHash = hashIndex >= 0 ? path.slice(0, hashIndex) : path;
  const queryIndex = withoutHash.indexOf("?");
  const pathname = queryIndex >= 0 ? withoutHash.slice(0, queryIndex) : withoutHash;
  const params = new URLSearchParams(queryIndex >= 0 ? withoutHash.slice(queryIndex + 1) : "");
  for (const key of UTM_KEYS) {
    const value = attribution[key];
    if (value && !params.get(key)) params.set(key, value);
  }
  const query = params.toString();
  return `${pathname}${query ? `?${query}` : ""}${hash}`;
}

export function signupSourceLabel(value: unknown): string | null {
  const parsed = parseSignupAttributionBody(value);
  if (!parsed?.utm_source) return null;
  const campaign = parsed.utm_campaign ? ` · ${parsed.utm_campaign}` : "";
  return `${parsed.utm_source}${campaign}`;
}
