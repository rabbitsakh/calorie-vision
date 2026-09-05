import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { findOrCreateTelegramUser } from "@/lib/telegram-auth";
import {
  claimsToTelegramAuthFields,
  exchangeTelegramOidcCode,
  getTelegramOidcClientId,
  getTelegramOidcClientSecret,
  isTelegramOidcConfigured,
  verifyTelegramIdToken,
} from "@/lib/telegram-oidc";
import { setNextAuthSessionCookie } from "@/lib/telegram-oidc-session";
import {
  TG_OIDC_STATE_COOKIE,
  TG_OIDC_VERIFIER_COOKIE,
  telegramOidcAppUrl,
  telegramOidcCookieOptions,
  telegramOidcRedirectUri,
  telegramOidcSiteOrigin,
} from "@/lib/telegram-oidc-route";
import { unsealTelegramOidcState } from "@/lib/telegram-oidc-state";

export const dynamic = "force-dynamic";

function loginErrorRedirect(request: Request, message: string) {
  const url = new URL(telegramOidcAppUrl("/login/telegram", request));
  url.searchParams.set("error", message);
  return NextResponse.redirect(url);
}

function clearOidcCookies(response: NextResponse, secure: boolean) {
  const clear = telegramOidcCookieOptions(secure, 0);
  response.cookies.set(TG_OIDC_STATE_COOKIE, "", clear);
  response.cookies.set(TG_OIDC_VERIFIER_COOKIE, "", clear);
}

function userFacingOidcError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  const code = message
    .replace(/[^A-Za-z0-9_:]/g, "")
    .slice(0, 48) || "UNKNOWN";

  if (/invalid_grant|redirect_uri|redirect uri/i.test(message)) {
    return `Telegram отклонил callback URL [${code}]. В BotFather: https://calorievision.ru/api/auth/telegram/callback`;
  }
  if (/invalid_client|unauthorized/i.test(message)) {
    return `Неверный TELEGRAM_CLIENT_SECRET [${code}]. Скопируйте Client Secret из BotFather → Login Widget (OIDC).`;
  }
  if (/BAD_AUD|MISSING_SUB|JWT|JWS|JWKS|issuer|JWK/i.test(message)) {
    return `Не удалось проверить ответ Telegram [${code}]. Проверьте TELEGRAM_CLIENT_ID.`;
  }
  if (/NEXTAUTH_SECRET/i.test(message)) {
    return `На сервере не задан NEXTAUTH_SECRET [${code}].`;
  }
  if (/fetch failed|ECONNRESET|ETIMEDOUT|ENOTFOUND/i.test(message)) {
    return `Сервер не достучался до Telegram [${code}]. Попробуйте ещё раз.`;
  }
  return `Не удалось войти через Telegram [${code}]`;
}

/**
 * Telegram OIDC callback: exchange code → verify id_token → create session cookie.
 * Avoids client-side ticket sign-in (fragile on iOS URL length / WebView).
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
  const cookieState = cookieStore.get(TG_OIDC_STATE_COOKIE)?.value;
  const cookieVerifier = cookieStore.get(TG_OIDC_VERIFIER_COOKIE)?.value;
  const sealed = state ? unsealTelegramOidcState(state) : null;
  const codeVerifier = sealed?.verifier || cookieVerifier;

  const origin = telegramOidcSiteOrigin(request);
  const secure = origin.startsWith("https://");
  const redirectUri = telegramOidcRedirectUri(origin);

  // Prefer sealed state (works without cookies). Fall back to cookie CSRF check.
  const stateOk = Boolean(sealed) || Boolean(state && cookieState && state === cookieState);

  if (!code || !state || !stateOk || !codeVerifier) {
    const response = loginErrorRedirect(
      request,
      "Сессия Telegram истекла [STATE]. Попробуйте ещё раз.",
    );
    clearOidcCookies(response, secure);
    return response;
  }

  try {
    const { id_token } = await exchangeTelegramOidcCode({
      code,
      redirectUri,
      codeVerifier,
      clientId,
      clientSecret,
    });
    const claims = await verifyTelegramIdToken(id_token, clientId);
    const fields = claimsToTelegramAuthFields(claims);
    const user = await findOrCreateTelegramUser({
      id: fields.id,
      first_name: fields.first_name,
      last_name: fields.last_name,
      username: fields.username,
      photo_url: fields.photo_url,
      phone_number: fields.phone_number,
      auth_date: Math.floor(Date.now() / 1000),
      hash: "oidc-session",
    });

    const next = NextResponse.redirect(telegramOidcAppUrl("/ration/", request));
    await setNextAuthSessionCookie(next, {
      id: user.id,
      name: user.name,
      email: user.email,
      image: user.image,
    });
    clearOidcCookies(next, secure);
    return next;
  } catch (error) {
    console.error("[telegram-oidc] callback failed:", {
      error,
      redirectUri,
      clientId,
      origin,
      hasSealedState: Boolean(sealed),
      hasCookieVerifier: Boolean(cookieVerifier),
    });
    const response = loginErrorRedirect(request, userFacingOidcError(error));
    clearOidcCookies(response, secure);
    return response;
  }
}
