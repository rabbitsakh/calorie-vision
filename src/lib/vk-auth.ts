import type { Profile } from "next-auth";
import type { OAuthConfig } from "next-auth/providers/oauth";

const VK_AUTHORIZE_URL = "https://id.vk.ru/authorize";
const VK_TOKEN_URL = "https://id.vk.ru/oauth2/auth";
const VK_USERINFO_URL = "https://id.vk.ru/oauth2/user_info";
const DEVICE_TTL_MS = 15 * 60 * 1000;

export type VkIdUser = {
  user_id?: string | number;
  first_name?: string;
  last_name?: string;
  email?: string;
  phone?: string;
  avatar?: string;
};

export type VkIdProfile = {
  user?: VkIdUser;
};

type OAuthRequestParams = Record<string, string | string[] | undefined>;

type DeviceCacheEntry = {
  deviceId: string;
  expiresAt: number;
};

const deviceIdsByState = new Map<string, DeviceCacheEntry>();

export function parseVkCallbackParams(params: OAuthRequestParams): {
  code: string;
  state: string;
  deviceId: string;
} {
  let payload: Record<string, unknown> = {};
  const rawPayload = firstString(params.payload);
  if (rawPayload) {
    try {
      payload = JSON.parse(rawPayload) as Record<string, unknown>;
    } catch {
      payload = {};
    }
  }

  return {
    code: stringValue(payload.code) || firstString(params.code),
    state: stringValue(payload.state) || firstString(params.state),
    deviceId: stringValue(payload.device_id) || firstString(params.device_id),
  };
}

export function rememberVkDeviceId(state: string, deviceId: string): void {
  if (!state || !deviceId) {
    return;
  }

  deviceIdsByState.set(state, {
    deviceId,
    expiresAt: Date.now() + DEVICE_TTL_MS,
  });
}

export function takeVkDeviceId(state: string): string {
  const entry = deviceIdsByState.get(state);
  if (!entry) {
    return "";
  }

  deviceIdsByState.delete(state);
  if (entry.expiresAt < Date.now()) {
    return "";
  }

  return entry.deviceId;
}

/**
 * NextAuth/openid-client keep only standard OAuth fields (`code`, `state`, …)
 * and drop VK ID's `payload` / `device_id`. Unpack them first and stash
 * `device_id` by `state` so the token request can still send it.
 */
export function applyVkCallbackToSearchParams(search: URLSearchParams): URLSearchParams {
  const parsed = parseVkCallbackParams(Object.fromEntries(search.entries()));
  rememberVkDeviceId(parsed.state, parsed.deviceId);

  const next = new URLSearchParams(search);
  if (parsed.code) {
    next.set("code", parsed.code);
  }
  if (parsed.state) {
    next.set("state", parsed.state);
  }
  next.delete("payload");
  next.delete("device_id");
  return next;
}

export function getVkRedirectUri(nextAuthUrl = process.env.NEXTAUTH_URL): string {
  const fallback = "http://localhost:3000";
  const raw = (nextAuthUrl || fallback).trim();

  try {
    const url = new URL(/^https?:\/\//i.test(raw) ? raw : `https://${raw}`);
    let path = url.pathname.replace(/\/+$/, "");
    if (path === "/api/auth" || path.endsWith("/api/auth")) {
      path = path.slice(0, -"/api/auth".length);
    }
    const base = `${url.origin}${path && path !== "/" ? path : ""}`;
    return `${base}/api/auth/callback/vk`;
  } catch {
    return `${fallback}/api/auth/callback/vk`;
  }
}

export function vkProfileToUser(profile: VkIdProfile | VkIdUser): {
  id: string;
  name: string;
  email: string | null;
  image: string | null;
} {
  const user = "user" in profile && profile.user ? profile.user : (profile as VkIdUser);
  const name = [user.first_name, user.last_name].filter(Boolean).join(" ");

  return {
    id: String(user.user_id ?? ""),
    name: name || "Пользователь VK",
    email: user.email || null,
    image: user.avatar || null,
  };
}

export function buildVkTokenRequestBody(input: {
  code: string;
  codeVerifier: string;
  clientId: string;
  clientSecret?: string;
  redirectUri: string;
  deviceId: string;
  state: string;
}): URLSearchParams {
  const body = new URLSearchParams({
    grant_type: "authorization_code",
    code: input.code,
    code_verifier: input.codeVerifier,
    client_id: input.clientId,
    redirect_uri: input.redirectUri,
    device_id: input.deviceId,
    state: input.state,
  });

  if (input.clientSecret) {
    body.set("client_secret", input.clientSecret);
    body.set("service_token", input.clientSecret);
  }

  return body;
}

export function createVkIdProvider(options: {
  clientId: string;
  clientSecret?: string;
}): OAuthConfig<VkIdProfile> {
  const redirectUri = getVkRedirectUri();

  return {
    id: "vk",
    name: "VK",
    type: "oauth",
    checks: ["pkce", "state"],
    clientId: options.clientId,
    clientSecret: options.clientSecret ?? "",
    client: {
      token_endpoint_auth_method: "client_secret_post",
    },
    authorization: {
      url: VK_AUTHORIZE_URL,
      params: {
        response_type: "code",
        scope: "email phone",
        lang_id: 0,
        redirect_uri: redirectUri,
      },
    },
    token: {
      url: VK_TOKEN_URL,
      async request({ provider, params, checks }) {
        const callback = parseVkCallbackParams(params as OAuthRequestParams);
        const state =
          callback.state || (typeof checks.state === "string" ? checks.state : "");
        const deviceId = callback.deviceId || takeVkDeviceId(state);
        if (!callback.code || !deviceId) {
          throw new Error(
            "VK не вернул code или device_id. Проверьте Redirect URL в кабинете VK ID.",
          );
        }

        const body = buildVkTokenRequestBody({
          code: callback.code,
          codeVerifier: typeof checks.code_verifier === "string" ? checks.code_verifier : "",
          clientId: String(provider.clientId ?? ""),
          clientSecret: provider.clientSecret ? String(provider.clientSecret) : undefined,
          redirectUri,
          deviceId,
          state,
        });

        const response = await fetch(VK_TOKEN_URL, {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body,
        });
        const tokens = (await response.json()) as {
          error?: string;
          error_description?: string | { error?: string };
          access_token?: string;
        };
        if (!response.ok || tokens.error || !tokens.access_token) {
          const description =
            typeof tokens.error_description === "string"
              ? tokens.error_description
              : tokens.error_description?.error;
          throw new Error(description ?? tokens.error ?? "VK не выдал access token");
        }

        return { tokens };
      },
    },
    userinfo: {
      url: VK_USERINFO_URL,
      async request({ tokens, provider }) {
        const response = await fetch(VK_USERINFO_URL, {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams({
            access_token: String(tokens.access_token ?? ""),
            client_id: String(provider.clientId ?? ""),
          }),
        });
        const profile = (await response.json()) as VkIdProfile & {
          error?: string;
          error_description?: string;
        };
        if (!response.ok || profile.error) {
          throw new Error(profile.error_description ?? profile.error ?? "VK не вернул профиль");
        }
        return profile as unknown as Profile;
      },
    },
    profile(profile) {
      return vkProfileToUser(profile);
    },
    allowDangerousEmailAccountLinking: true,
  };
}

function firstString(value: string | string[] | undefined): string {
  if (Array.isArray(value)) {
    return value[0] ?? "";
  }
  return value ?? "";
}

function stringValue(value: unknown): string {
  return typeof value === "string" ? value : "";
}
