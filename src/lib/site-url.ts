import { basePath } from "@/lib/paths";

const DEFAULT_ORIGIN = "https://calorievision.ru";

/** Public site origin (no path). Prefer NEXTAUTH_URL / NEXT_PUBLIC_SITE_URL. */
export function getSiteOrigin(
  nextAuthUrl = process.env.NEXTAUTH_URL,
  siteUrl = process.env.NEXT_PUBLIC_SITE_URL,
): string {
  for (const raw of [siteUrl, nextAuthUrl]) {
    const trimmed = raw?.trim();
    if (!trimmed) continue;
    try {
      return new URL(trimmed).origin;
    } catch {
      // try next candidate
    }
  }
  return DEFAULT_ORIGIN;
}

/** Absolute URL for a site path (respects NEXT_PUBLIC_BASE_PATH). */
export function absoluteSiteUrl(
  path = "/",
  origin = getSiteOrigin(),
): string {
  const normalized = path.startsWith("/") ? path : `/${path}`;
  const withBase = `${basePath}${normalized}` || "/";
  return new URL(withBase, `${origin}/`).toString();
}
