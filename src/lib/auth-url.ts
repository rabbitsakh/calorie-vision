const AUTH_PATH = "/api/auth";
const PRODUCTION_SITE = "https://calorievision.ru";

function withProtocol(raw: string): string {
  return /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
}

function isLocalhostUrl(raw: string): boolean {
  try {
    const host = new URL(withProtocol(raw)).hostname;
    return host === "localhost" || host === "127.0.0.1" || host === "::1";
  } catch {
    return /localhost|127\.0\.0\.1/i.test(raw);
  }
}

/**
 * Public site origin for redirects, emails, OAuth callbacks.
 * In production never falls back to localhost — that sent Custom Tabs to
 * ERR_CONNECTION_REFUSED after Google login when NEXTAUTH_URL was missing/wrong.
 */
export function getCanonicalSiteUrl(
  nextAuthUrl = process.env.NEXTAUTH_URL || process.env.NEXT_PUBLIC_APP_URL,
  basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "",
): string {
  const productionFallback = `${PRODUCTION_SITE}${basePath}`;
  const devFallback = `http://localhost:3000${basePath}`;
  const raw = (nextAuthUrl || "").trim();

  if (!raw) {
    return process.env.NODE_ENV === "production" ? productionFallback : devFallback;
  }

  // Misconfigured prod .env with localhost → treat as unset in production.
  if (process.env.NODE_ENV === "production" && isLocalhostUrl(raw)) {
    return productionFallback;
  }

  try {
    const url = new URL(withProtocol(raw));
    const path = url.pathname.replace(/\/+$/, "");

    if (path === AUTH_PATH || path.endsWith(AUTH_PATH)) {
      url.pathname = path.slice(0, -AUTH_PATH.length) || "/";
    }

    url.search = "";
    url.hash = "";

    let site = `${url.origin}${url.pathname === "/" ? "" : url.pathname.replace(/\/+$/, "")}`;
    if (basePath && !site.endsWith(basePath)) {
      site = `${site}${basePath}`;
    }

    return site;
  } catch {
    return process.env.NODE_ENV === "production" ? productionFallback : devFallback;
  }
}

const EXTRA_ALLOWED_ORIGINS = new Set([
  "https://calorievision.ru",
  "https://www.calorievision.ru",
]);

export function resolveAuthRedirect(
  url: string,
  siteUrl = getCanonicalSiteUrl(),
): string {
  const site = siteUrl.replace(/\/+$/, "") || siteUrl;

  if (url.startsWith("/")) {
    return `${site}${url}`;
  }

  try {
    const destination = new URL(url);
    const allowed = new URL(site);
    if (
      destination.origin === allowed.origin ||
      EXTRA_ALLOWED_ORIGINS.has(destination.origin)
    ) {
      return destination.toString();
    }
  } catch {
    // Ignore invalid absolute URLs and fall back to the site root.
  }

  return `${site}/`;
}

/** Browser origin for Capacitor OAuth bootstrap — never localhost on a phone. */
export function publicBrowserOrigin(origin = typeof window !== "undefined" ? window.location.origin : ""): string {
  if (!origin || isLocalhostUrl(origin)) {
    return PRODUCTION_SITE;
  }
  try {
    return new URL(origin).origin;
  } catch {
    return PRODUCTION_SITE;
  }
}
