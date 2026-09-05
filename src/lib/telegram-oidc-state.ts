import { createHmac, timingSafeEqual } from "crypto";

type SealedOidcState = {
  v: string; // PKCE verifier
  e: number; // expiry unix seconds
};

function sealSecret(): string {
  const secret = process.env.NEXTAUTH_SECRET?.trim() || process.env.AUTH_SECRET?.trim();
  if (!secret) {
    throw new Error("NEXTAUTH_SECRET is required for Telegram OIDC state");
  }
  return secret;
}

/** Pack PKCE verifier into the OAuth `state` so iOS can complete login without cookies. */
export function sealTelegramOidcState(verifier: string, maxAgeSec = 10 * 60): string {
  const body: SealedOidcState = {
    v: verifier,
    e: Math.floor(Date.now() / 1000) + maxAgeSec,
  };
  const json = Buffer.from(JSON.stringify(body), "utf8").toString("base64url");
  const sig = createHmac("sha256", sealSecret()).update(json).digest("base64url");
  return `${json}.${sig}`;
}

export function unsealTelegramOidcState(state: string): { verifier: string } | null {
  const trimmed = state.trim();
  const dot = trimmed.lastIndexOf(".");
  if (dot <= 0) {
    return null;
  }

  const json = trimmed.slice(0, dot);
  const sig = trimmed.slice(dot + 1);
  if (!json || !sig) {
    return null;
  }

  const expected = createHmac("sha256", sealSecret()).update(json).digest("base64url");
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    return null;
  }

  try {
    const payload = JSON.parse(Buffer.from(json, "base64url").toString("utf8")) as SealedOidcState;
    if (!payload?.v || typeof payload.e !== "number") {
      return null;
    }
    if (payload.e < Math.floor(Date.now() / 1000)) {
      return null;
    }
    return { verifier: payload.v };
  } catch {
    return null;
  }
}
