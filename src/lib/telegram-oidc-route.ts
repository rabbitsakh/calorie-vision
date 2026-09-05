import { withBasePath } from "@/lib/paths";

export const TG_OIDC_STATE_COOKIE = "tg_oidc_state";
export const TG_OIDC_VERIFIER_COOKIE = "tg_oidc_verifier";

export const TG_OIDC_COOKIE_MAX_AGE = 10 * 60;

export function telegramOidcSiteOrigin(requestUrl?: string): string {
  const siteUrl = process.env.NEXTAUTH_URL?.trim() || process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (siteUrl) {
    try {
      return new URL(siteUrl).origin.replace("://www.", "://");
    } catch {
      // fall through
    }
  }
  if (requestUrl) {
    return new URL(requestUrl).origin.replace("://www.", "://");
  }
  return "";
}

export function telegramOidcRedirectUri(origin: string): string {
  return `${origin}${withBasePath("/api/auth/telegram/callback")}`;
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
