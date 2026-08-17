const AUTH_PATH = "/api/auth";

function withProtocol(raw: string): string {
  return /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
}

export function getCanonicalSiteUrl(
  nextAuthUrl = process.env.NEXTAUTH_URL,
  basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "",
): string {
  const fallback = "http://localhost:3000";
  const raw = (nextAuthUrl || fallback).trim();

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
    return `${fallback}${basePath}`;
  }
}

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
    if (destination.origin === allowed.origin) {
      return destination.toString();
    }
  } catch {
    // Ignore invalid absolute URLs and fall back to the site root.
  }

  return `${site}/`;
}
