import { NextResponse } from "next/server";
import { withBasePath } from "@/lib/paths";
import {
  buildTelegramOidcAuthorizeUrl,
  createOidcState,
  createPkcePair,
  getTelegramOidcClientId,
  isTelegramOidcConfigured,
} from "@/lib/telegram-oidc";

export const dynamic = "force-dynamic";

export const TG_OIDC_STATE_COOKIE = "tg_oidc_state";
export const TG_OIDC_VERIFIER_COOKIE = "tg_oidc_verifier";

const COOKIE_MAX_AGE = 10 * 60;

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

function cookieOptions(secure: boolean) {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure,
    path: "/",
    maxAge: COOKIE_MAX_AGE,
  };
}

/**
 * Starts Telegram OIDC (Authorization Code + PKCE) with the phone scope.
 * Requires TELEGRAM_CLIENT_SECRET from BotFather → Login Widget.
 */
export async function GET(request: Request) {
  if (!isTelegramOidcConfigured()) {
    return NextResponse.redirect(new URL(withBasePath("/login?error=Telegram"), request.url));
  }

  const clientId = getTelegramOidcClientId();
  if (!clientId) {
    return NextResponse.redirect(new URL(withBasePath("/login?error=Telegram"), request.url));
  }

  const origin = telegramOidcSiteOrigin(request.url);
  const { verifier, challenge } = createPkcePair();
  const state = createOidcState();
  const authorizeUrl = buildTelegramOidcAuthorizeUrl({
    clientId,
    redirectUri: telegramOidcRedirectUri(origin),
    state,
    codeChallenge: challenge,
    requestPhone: true,
  });

  const secure = origin.startsWith("https://");
  const response = NextResponse.redirect(authorizeUrl);
  response.cookies.set(TG_OIDC_STATE_COOKIE, state, cookieOptions(secure));
  response.cookies.set(TG_OIDC_VERIFIER_COOKIE, verifier, cookieOptions(secure));
  return response;
}
