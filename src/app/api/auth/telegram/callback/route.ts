import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { withBasePath } from "@/lib/paths";
import {
  claimsToTelegramAuthFields,
  exchangeTelegramOidcCode,
  getTelegramOidcClientId,
  getTelegramOidcClientSecret,
  isTelegramOidcConfigured,
  verifyTelegramIdToken,
} from "@/lib/telegram-oidc";
import { createTelegramLoginTicket } from "@/lib/telegram-oidc-ticket";
import {
  TG_OIDC_STATE_COOKIE,
  TG_OIDC_VERIFIER_COOKIE,
  telegramOidcCookieOptions,
  telegramOidcRedirectUri,
  telegramOidcSiteOrigin,
} from "@/lib/telegram-oidc-route";

export const dynamic = "force-dynamic";

function loginErrorRedirect(request: Request, message: string) {
  const url = new URL(withBasePath("/login/telegram"), request.url);
  url.searchParams.set("error", message);
  return NextResponse.redirect(url);
}

function clearOidcCookies(response: NextResponse, secure: boolean) {
  const clear = telegramOidcCookieOptions(secure, 0);
  response.cookies.set(TG_OIDC_STATE_COOKIE, "", clear);
  response.cookies.set(TG_OIDC_VERIFIER_COOKIE, "", clear);
}

/**
 * Telegram OIDC callback: exchange code → verify id_token → issue short-lived ticket
 * for Credentials sign-in on /login/telegram.
 */
export async function GET(request: Request) {
  if (!isTelegramOidcConfigured()) {
    return loginErrorRedirect(request, "Telegram OIDC не настроен");
  }

  const clientId = getTelegramOidcClientId();
  const clientSecret = getTelegramOidcClientSecret();
  if (!clientId || !clientSecret) {
    return loginErrorRedirect(request, "Telegram OIDC не настроен");
  }

  const url = new URL(request.url);
  const code = url.searchParams.get("code")?.trim();
  const state = url.searchParams.get("state")?.trim();
  const oauthError = url.searchParams.get("error");

  if (oauthError) {
    return loginErrorRedirect(request, "Вход через Telegram отменён");
  }

  const cookieStore = await cookies();
  const expectedState = cookieStore.get(TG_OIDC_STATE_COOKIE)?.value;
  const codeVerifier = cookieStore.get(TG_OIDC_VERIFIER_COOKIE)?.value;
  const origin = telegramOidcSiteOrigin(request.url);
  const secure = origin.startsWith("https://");

  if (!code || !state || !expectedState || state !== expectedState || !codeVerifier) {
    const response = loginErrorRedirect(request, "Сессия Telegram истекла. Попробуйте ещё раз.");
    clearOidcCookies(response, secure);
    return response;
  }

  try {
    const { id_token } = await exchangeTelegramOidcCode({
      code,
      redirectUri: telegramOidcRedirectUri(origin),
      codeVerifier,
      clientId,
      clientSecret,
    });
    const claims = await verifyTelegramIdToken(id_token, clientId);
    const fields = claimsToTelegramAuthFields(claims);
    const ticket = createTelegramLoginTicket({
      id: fields.id,
      first_name: fields.first_name,
      last_name: fields.last_name,
      username: fields.username,
      photo_url: fields.photo_url,
      phone_number: fields.phone_number,
    });

    const next = new URL(withBasePath("/login/telegram"), request.url);
    next.searchParams.set("ticket", ticket);
    const response = NextResponse.redirect(next);
    clearOidcCookies(response, secure);
    return response;
  } catch (error) {
    console.error("[telegram-oidc] callback failed:", error);
    const response = loginErrorRedirect(request, "Не удалось войти через Telegram");
    clearOidcCookies(response, secure);
    return response;
  }
}
