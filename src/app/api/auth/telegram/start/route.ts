import { NextResponse } from "next/server";
import { withBasePath } from "@/lib/paths";
import {
  buildTelegramOidcAuthorizeUrl,
  createOidcState,
  createPkcePair,
  getTelegramOidcClientId,
  isTelegramOidcConfigured,
} from "@/lib/telegram-oidc";
import {
  TG_OIDC_STATE_COOKIE,
  TG_OIDC_VERIFIER_COOKIE,
  telegramOidcCookieOptions,
  telegramOidcRedirectUri,
  telegramOidcSiteOrigin,
} from "@/lib/telegram-oidc-route";

export const dynamic = "force-dynamic";

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
  response.cookies.set(TG_OIDC_STATE_COOKIE, state, telegramOidcCookieOptions(secure));
  response.cookies.set(TG_OIDC_VERIFIER_COOKIE, verifier, telegramOidcCookieOptions(secure));
  return response;
}
