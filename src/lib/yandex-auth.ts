import type { OAuthConfig } from "next-auth/providers/oauth";
import YandexProvider from "next-auth/providers/yandex";
import type { YandexProfile } from "next-auth/providers/yandex";
import { normalizeAuthPhone } from "@/lib/phone";

/**
 * Default Yandex ID scopes (same as next-auth built-in).
 * Do NOT use `login:phone` — Yandex returns invalid_scope.
 * Phone is `login:default_phone`, and only if that right is enabled on the OAuth app.
 */
export const YANDEX_OAUTH_SCOPE_DEFAULT = "login:info+login:email+login:avatar";

/** Optional phone claim — enable «Доступ к номеру телефона» in oauth.yandex.ru first. */
export const YANDEX_OAUTH_SCOPE_WITH_PHONE =
  "login:info+login:email+login:avatar+login:default_phone";

/**
 * Resolve authorize scope.
 * - YANDEX_OAUTH_SCOPE=… → exact override (plus-separated)
 * - YANDEX_REQUEST_PHONE=1 → include login:default_phone
 * - otherwise → info+email+avatar (safe default)
 */
export function resolveYandexOAuthScope(
  env: NodeJS.ProcessEnv = process.env,
): string {
  const override = env.YANDEX_OAUTH_SCOPE?.trim();
  if (override) {
    return override.replace(/\s+/g, "+");
  }
  const wantPhone = /^(1|true|yes)$/i.test(env.YANDEX_REQUEST_PHONE?.trim() ?? "");
  return wantPhone ? YANDEX_OAUTH_SCOPE_WITH_PHONE : YANDEX_OAUTH_SCOPE_DEFAULT;
}

export function yandexAuthorizeUrl(scope = resolveYandexOAuthScope()): string {
  return `https://oauth.yandex.ru/authorize?scope=${scope}`;
}

/** @deprecated use resolveYandexOAuthScope / yandexAuthorizeUrl */
export const YANDEX_OAUTH_SCOPE = YANDEX_OAUTH_SCOPE_DEFAULT;
export const YANDEX_AUTHORIZE_URL = yandexAuthorizeUrl(YANDEX_OAUTH_SCOPE_DEFAULT);

export function yandexProfileToUser(profile: YandexProfile): {
  id: string;
  name: string;
  email: string | null;
  image: string | null;
  phone: string | null;
} {
  const email =
    profile.default_email?.trim() ||
    (Array.isArray(profile.emails) ? profile.emails[0]?.trim() : "") ||
    null;
  const phone = normalizeAuthPhone(profile.default_phone?.number);
  const name =
    profile.display_name?.trim() ||
    profile.real_name?.trim() ||
    profile.first_name?.trim() ||
    "Пользователь Яндекс";
  const image =
    !profile.is_avatar_empty && profile.default_avatar_id
      ? `https://avatars.yandex.net/get-yapic/${profile.default_avatar_id}/islands-200`
      : null;

  return {
    id: String(profile.id ?? ""),
    name,
    email: email ? email.toLowerCase() : null,
    image,
    phone,
  };
}

export function createYandexProvider(options: {
  clientId: string;
  clientSecret: string;
}): OAuthConfig<YandexProfile> {
  return YandexProvider({
    clientId: options.clientId,
    clientSecret: options.clientSecret,
    authorization: yandexAuthorizeUrl(),
    profile(profile) {
      const user = yandexProfileToUser(profile);
      if (!user.id) {
        throw new Error("Яндекс не вернул идентификатор пользователя");
      }
      return user;
    },
    allowDangerousEmailAccountLinking: true,
  });
}

export function isYandexLoginConfigured(): boolean {
  return Boolean(process.env.YANDEX_CLIENT_ID?.trim() && process.env.YANDEX_CLIENT_SECRET?.trim());
}
