import type { Profile } from "next-auth";
import type { OAuthConfig } from "next-auth/providers/oauth";

const VK_AUTHORIZE_URL = "https://id.vk.ru/authorize";
const VK_TOKEN_URL = "https://id.vk.ru/oauth2/auth";
const VK_USERINFO_URL = "https://id.vk.ru/oauth2/user_info";

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
  }

  return body;
}

export function createVkIdProvider(options: {
  clientId: string;
  clientSecret?: string;
}): OAuthConfig<VkIdProfile> {
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
      },
    },
    token: {
      url: VK_TOKEN_URL,
      async request({ provider, params, checks }) {
        const callback = parseVkCallbackParams(params as OAuthRequestParams);
        const body = buildVkTokenRequestBody({
          code: callback.code,
          codeVerifier: typeof checks.code_verifier === "string" ? checks.code_verifier : "",
          clientId: String(provider.clientId ?? ""),
          clientSecret: provider.clientSecret ? String(provider.clientSecret) : undefined,
          redirectUri: provider.callbackUrl,
          deviceId: callback.deviceId,
          state: callback.state,
        });

        const response = await fetch(VK_TOKEN_URL, {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body,
        });
        const tokens = (await response.json()) as {
          error?: string;
          error_description?: string;
          access_token?: string;
        };
        if (!response.ok || tokens.error || !tokens.access_token) {
          throw new Error(tokens.error_description ?? tokens.error ?? "VK не выдал access token");
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
        const profile = (await response.json()) as VkIdProfile & { error?: string; error_description?: string };
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
