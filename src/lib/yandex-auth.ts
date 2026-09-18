import type { OAuthConfig } from "next-auth/providers/oauth";
import YandexProvider from "next-auth/providers/yandex";
import type { YandexProfile } from "next-auth/providers/yandex";
import { normalizeAuthPhone } from "@/lib/phone";

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
    authorization: {
      url: "https://oauth.yandex.ru/authorize",
      params: {
        scope: "login:info login:email login:avatar login:phone",
      },
    },
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
