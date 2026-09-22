import { NextResponse } from "next/server";
import {
  buildTelegramOidcAuthorizeUrl,
  createPkcePair,
  getTelegramOidcClientId,
  isTelegramOidcConfigured,
} from "@/lib/telegram-oidc";
import {
  TG_OIDC_NATIVE_COOKIE,
  TG_OIDC_STATE_COOKIE,
  TG_OIDC_VERIFIER_COOKIE,
  telegramOidcAppUrl,
  telegramOidcCookieOptions,
  telegramOidcRedirectUri,
  telegramOidcSiteOrigin,
} from "@/lib/telegram-oidc-route";
import { sealTelegramOidcState } from "@/lib/telegram-oidc-state";

export const dynamic = "force-dynamic";

/**
 * Starts Telegram OIDC (Authorization Code + PKCE) with the phone scope.
 * Requires TELEGRAM_CLIENT_SECRET from BotFather → Login Widget.
 * `?native=1` — Capacitor Custom Tabs: after login redirect to /auth/native-bridge.
 */
export async function GET(request: Request) {
  if (!isTelegramOidcConfigured()) {
    return NextResponse.redirect(telegramOidcAppUrl("/login?error=Telegram", request));
  }

  const clientId = getTelegramOidcClientId();
  if (!clientId) {
    return NextResponse.redirect(telegramOidcAppUrl("/login?error=Telegram", request));
  }

  const origin = telegramOidcSiteOrigin(request);
  if (!origin || origin.includes("localhost") || origin.includes("127.0.0.1")) {
    console.error(
      "[telegram-oidc] Public origin missing or localhost. Set NEXTAUTH_URL=https://calorievision.ru",
      { origin },
    );
    return NextResponse.redirect(telegramOidcAppUrl("/login?error=TelegramConfig", request));
  }

  const wantNative = new URL(request.url).searchParams.get("native") === "1";

  try {
    const { verifier, challenge } = createPkcePair();
    // Embed verifier in `state` so iOS can finish login even if cookies are dropped.
    const state = sealTelegramOidcState(verifier);
    const authorizeUrl = buildTelegramOidcAuthorizeUrl({
      clientId,
      redirectUri: telegramOidcRedirectUri(origin),
      state,
      codeChallenge: challenge,
      requestPhone: true,
    });

    const secure = origin.startsWith("https://");
    const response = NextResponse.redirect(authorizeUrl);
    // Keep cookies as a fallback for older clients / non-iOS browsers.
    response.cookies.set(TG_OIDC_STATE_COOKIE, state, telegramOidcCookieOptions(secure));
    response.cookies.set(TG_OIDC_VERIFIER_COOKIE, verifier, telegramOidcCookieOptions(secure));
    if (wantNative) {
      response.cookies.set(TG_OIDC_NATIVE_COOKIE, "1", telegramOidcCookieOptions(secure));
    } else {
      response.cookies.set(TG_OIDC_NATIVE_COOKIE, "", { ...telegramOidcCookieOptions(secure, 0), maxAge: 0 });
    }
    return response;
  } catch (error) {
    console.error("[telegram-oidc] start failed:", error);
    return NextResponse.redirect(telegramOidcAppUrl("/login?error=TelegramConfig", request));
  }
}
