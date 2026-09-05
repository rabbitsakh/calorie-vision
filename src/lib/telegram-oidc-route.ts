import { getCanonicalSiteUrl } from "@/lib/auth-url";
import { withBasePath } from "@/lib/paths";

export const TG_OIDC_STATE_COOKIE = "tg_oidc_state";
export const TG_OIDC_VERIFIER_COOKIE = "tg_oidc_verifier";

export const TG_OIDC_COOKIE_MAX_AGE = 10 * 60;

function isLocalhostHost(hostname: string): boolean {
  const host = hostname.trim().toLowerCase();
  return host === "localhost" || host === "127.0.0.1" || host === "::1" || host === "0.0.0.0";
}

function originFromUrlString(raw: string | null | undefined): string | null {
  if (!raw?.trim()) {
    return null;
  }
  try {
    return new URL(raw.includes("://") ? raw : `https://${raw}`).origin.replace("://www.", "://");
  } catch {
    return null;
  }
}

/**
 * Public site origin for Telegram OIDC redirect_uri.
 * Prefers NEXTAUTH_URL / NEXT_PUBLIC_APP_URL, then forwarded proxy headers.
 * Never uses an internal localhost request host when a public URL is configured.
 */
export function telegramOidcSiteOrigin(request?: Request): string {
  const configured =
    originFromUrlString(process.env.NEXTAUTH_URL) ||
    originFromUrlString(process.env.NEXT_PUBLIC_APP_URL) ||
    originFromUrlString(getCanonicalSiteUrl());

  if (configured && !isLocalhostHost(new URL(configured).hostname)) {
    return configured;
  }

  if (request) {
    const forwardedHost = request.headers.get("x-forwarded-host")?.split(",")[0]?.trim();
    const forwardedProto = request.headers.get("x-forwarded-proto")?.split(",")[0]?.trim() || "https";
    if (forwardedHost && !isLocalhostHost(forwardedHost.split(":")[0] ?? forwardedHost)) {
      const fromForwarded = originFromUrlString(`${forwardedProto}://${forwardedHost}`);
      if (fromForwarded) {
        return fromForwarded;
      }
    }

    const host = request.headers.get("host")?.split(",")[0]?.trim();
    if (host && !isLocalhostHost(host.split(":")[0] ?? host)) {
      const proto =
        request.headers.get("x-forwarded-proto")?.split(",")[0]?.trim() ||
        (new URL(request.url).protocol === "https:" ? "https" : "http");
      const fromHost = originFromUrlString(`${proto}://${host}`);
      if (fromHost) {
        return fromHost;
      }
    }
  }

  if (configured) {
    return configured;
  }

  if (request) {
    return new URL(request.url).origin.replace("://www.", "://");
  }

  return "";
}

export function telegramOidcRedirectUri(origin: string): string {
  return `${origin}${withBasePath("/api/auth/telegram/callback")}`;
}

/** Absolute URL on the public site (avoids redirects to internal localhost). */
export function telegramOidcAppUrl(path: string, request?: Request): string {
  const origin = telegramOidcSiteOrigin(request);
  const normalized = path.startsWith("/") ? path : `/${path}`;
  return `${origin}${withBasePath(normalized)}`;
}

export function telegramOidcCookieOptions(secure: boolean, maxAge = TG_OIDC_COOKIE_MAX_AGE) {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure,
    path: "/",
    maxAge,
  };
}
