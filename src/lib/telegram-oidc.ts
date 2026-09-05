import { createHash, randomBytes } from "crypto";
import { createRemoteJWKSet, jwtVerify } from "jose";

const TELEGRAM_ISSUER = "https://oauth.telegram.org";
const TELEGRAM_JWKS_URL = new URL("https://oauth.telegram.org/.well-known/jwks.json");
const TELEGRAM_AUTH_URL = "https://oauth.telegram.org/auth";
const TELEGRAM_TOKEN_URL = "https://oauth.telegram.org/token";

const jwks = createRemoteJWKSet(TELEGRAM_JWKS_URL);

export type TelegramOidcClaims = {
  sub: string;
  id?: number | string;
  name?: string;
  given_name?: string;
  family_name?: string;
  preferred_username?: string;
  picture?: string;
  phone_number?: string;
  phone_number_verified?: boolean;
  iat?: number;
  exp?: number;
};

export function getTelegramOidcClientId(): string | null {
  const explicit = process.env.TELEGRAM_CLIENT_ID?.trim();
  if (explicit) {
    return explicit;
  }
  const token = process.env.TELEGRAM_BOT_TOKEN?.trim() ?? "";
  if (!token.includes(":")) {
    return null;
  }
  const botId = token.slice(0, token.indexOf(":"));
  return /^\d+$/.test(botId) ? botId : null;
}

export function getTelegramOidcClientSecret(): string | null {
  return process.env.TELEGRAM_CLIENT_SECRET?.trim() || null;
}

/** OIDC with phone requires Client Secret from BotFather → Login Widget. */
export function isTelegramOidcConfigured(): boolean {
  return Boolean(getTelegramOidcClientId() && getTelegramOidcClientSecret());
}

export function createPkcePair(): { verifier: string; challenge: string } {
  const verifier = randomBytes(32).toString("base64url");
  const challenge = createHash("sha256").update(verifier).digest("base64url");
  return { verifier, challenge };
}

export function createOidcState(): string {
  return randomBytes(24).toString("base64url");
}

export function buildTelegramOidcAuthorizeUrl(input: {
  clientId: string;
  redirectUri: string;
  state: string;
  codeChallenge: string;
  requestPhone?: boolean;
}): string {
  const scope = input.requestPhone ? "openid profile phone" : "openid profile";
  const url = new URL(TELEGRAM_AUTH_URL);
  url.searchParams.set("client_id", input.clientId);
  url.searchParams.set("redirect_uri", input.redirectUri);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", scope);
  url.searchParams.set("state", input.state);
  url.searchParams.set("code_challenge", input.codeChallenge);
  url.searchParams.set("code_challenge_method", "S256");
  url.searchParams.set("lang", "ru");
  return url.toString();
}

function audienceMatches(aud: unknown, clientId: string): boolean {
  const expected = String(clientId);
  if (typeof aud === "string" || typeof aud === "number") {
    return String(aud) === expected;
  }
  if (Array.isArray(aud)) {
    return aud.some((value) => String(value) === expected);
  }
  return false;
}

/** Prefer Telegram numeric user id when present; otherwise a numeric `sub`. */
export function resolveTelegramUserId(claims: Pick<TelegramOidcClaims, "id" | "sub">): string {
  if (claims.id !== undefined && claims.id !== null && String(claims.id).trim()) {
    return String(claims.id);
  }
  const sub = String(claims.sub);
  if (/^\d+$/.test(sub)) {
    return sub;
  }
  // Some Telegram tokens nest the user id after a prefix — keep digits-only tail if obvious.
  const digits = sub.match(/(\d{5,})$/);
  if (digits?.[1]) {
    return digits[1];
  }
  return sub;
}

export async function exchangeTelegramOidcCode(input: {
  code: string;
  redirectUri: string;
  codeVerifier: string;
  clientId: string;
  clientSecret: string;
}): Promise<{ id_token: string }> {
  const body = new URLSearchParams({
    grant_type: "authorization_code",
    code: input.code,
    redirect_uri: input.redirectUri,
    client_id: input.clientId,
    code_verifier: input.codeVerifier,
  });

  // Prefer Basic auth (Telegram default); fall back to client_secret_post.
  const attempts: Array<Record<string, string>> = [
    {
      Authorization: `Basic ${Buffer.from(`${input.clientId}:${input.clientSecret}`).toString("base64")}`,
    },
    {},
  ];

  let lastError = "TELEGRAM_TOKEN_EXCHANGE_FAILED";

  for (const [index, extraHeaders] of attempts.entries()) {
    const attemptBody = new URLSearchParams(body);
    if (index === 1) {
      attemptBody.set("client_secret", input.clientSecret);
    }

    const response = await fetch(TELEGRAM_TOKEN_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        ...extraHeaders,
      },
      body: attemptBody,
      cache: "no-store",
    });

    const json = (await response.json()) as {
      id_token?: string;
      error?: string;
      error_description?: string;
    };

    if (response.ok && json.id_token) {
      return { id_token: json.id_token };
    }

    lastError = json.error_description || json.error || `TELEGRAM_TOKEN_EXCHANGE_FAILED_${response.status}`;
    // invalid_client on Basic → try POST secret; otherwise stop.
    if (index === 0 && json.error && json.error !== "invalid_client") {
      break;
    }
  }

  throw new Error(lastError);
}

export async function verifyTelegramIdToken(
  idToken: string,
  clientId: string,
): Promise<TelegramOidcClaims> {
  // Don't pass `audience` to jose — Telegram may emit numeric `aud`, which fails strict string checks.
  const { payload } = await jwtVerify(idToken, jwks, {
    issuer: TELEGRAM_ISSUER,
    clockTolerance: 60,
  });

  if (!audienceMatches(payload.aud, clientId)) {
    throw new Error(`TELEGRAM_ID_TOKEN_BAD_AUD:${String(payload.aud)}`);
  }

  const sub = payload.sub;
  if (!sub) {
    throw new Error("TELEGRAM_ID_TOKEN_MISSING_SUB");
  }

  return {
    sub,
    id: (payload.id as number | string | undefined) ?? undefined,
    name: typeof payload.name === "string" ? payload.name : undefined,
    given_name: typeof payload.given_name === "string" ? payload.given_name : undefined,
    family_name: typeof payload.family_name === "string" ? payload.family_name : undefined,
    preferred_username:
      typeof payload.preferred_username === "string" ? payload.preferred_username : undefined,
    picture: typeof payload.picture === "string" ? payload.picture : undefined,
    phone_number: typeof payload.phone_number === "string" ? payload.phone_number : undefined,
    phone_number_verified: Boolean(payload.phone_number_verified),
    iat: typeof payload.iat === "number" ? payload.iat : undefined,
    exp: typeof payload.exp === "number" ? payload.exp : undefined,
  };
}

export function claimsToTelegramAuthFields(claims: TelegramOidcClaims): {
  id: string;
  first_name?: string;
  last_name?: string;
  username?: string;
  photo_url?: string;
  phone_number?: string;
  phone_number_verified?: boolean;
} {
  const full = claims.name?.trim() || "";
  const given = claims.given_name?.trim();
  const family = claims.family_name?.trim();
  let first = given;
  let last = family;
  if (!first && full) {
    const parts = full.split(/\s+/);
    first = parts[0];
    last = parts.slice(1).join(" ") || undefined;
  }

  return {
    id: resolveTelegramUserId(claims),
    first_name: first || undefined,
    last_name: last || undefined,
    username: claims.preferred_username || undefined,
    photo_url: claims.picture || undefined,
    phone_number: claims.phone_number,
    phone_number_verified: claims.phone_number_verified,
  };
}
