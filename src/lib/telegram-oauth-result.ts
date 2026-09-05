/**
 * Parse Telegram OAuth redirect payload.
 * oauth.telegram.org returns `#tgAuthResult=<base64url-json>` (not query params).
 * @see https://core.telegram.org/widgets/login
 */

export type TelegramOAuthFields = {
  id?: string;
  first_name?: string;
  last_name?: string;
  username?: string;
  photo_url?: string;
  auth_date?: string;
  hash?: string;
};

function decodeBase64Url(value: string): string {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const pad = "=".repeat((4 - (normalized.length % 4)) % 4);
  const input = normalized + pad;

  if (typeof atob === "function") {
    const binary = atob(input);
    try {
      return decodeURIComponent(
        Array.from(binary, (char) => `%${char.charCodeAt(0).toString(16).padStart(2, "0")}`).join(""),
      );
    } catch {
      return binary;
    }
  }

  return Buffer.from(input, "base64").toString("utf8");
}

/** Decode `#tgAuthResult=...` JSON into string fields used by CredentialsProvider. */
export function parseTgAuthResult(encoded: string): TelegramOAuthFields | null {
  const raw = encoded.trim();
  if (!raw) {
    return null;
  }

  try {
    const json = decodeBase64Url(raw);
    const data = JSON.parse(json) as Record<string, unknown>;
    if (!data || typeof data !== "object") {
      return null;
    }

    const pick = (key: string): string | undefined => {
      const value = data[key];
      if (value === undefined || value === null || value === "") {
        return undefined;
      }
      return String(value);
    };

    return {
      id: pick("id"),
      first_name: pick("first_name"),
      last_name: pick("last_name"),
      username: pick("username"),
      photo_url: pick("photo_url"),
      auth_date: pick("auth_date"),
      hash: pick("hash"),
    };
  } catch {
    return null;
  }
}

/** Merge hash fragment + query into Telegram login fields (prefers tgAuthResult). */
export function parseTelegramLoginCallback(
  hash: string,
  query: Record<string, string>,
): TelegramOAuthFields {
  const fromHash: Record<string, string> = {};
  const cleaned = hash.replace(/^#/, "");
  if (cleaned) {
    for (const part of cleaned.split("&")) {
      const [key, ...rest] = part.split("=");
      if (!key) continue;
      try {
        fromHash[decodeURIComponent(key)] = decodeURIComponent(rest.join("=") || "");
      } catch {
        fromHash[key] = rest.join("=") || "";
      }
    }
  }

  if (fromHash.tgAuthResult) {
    const decoded = parseTgAuthResult(fromHash.tgAuthResult);
    if (decoded) {
      return decoded;
    }
  }

  return {
    id: query.id ?? fromHash.id,
    first_name: query.first_name ?? fromHash.first_name,
    last_name: query.last_name ?? fromHash.last_name,
    username: query.username ?? fromHash.username,
    photo_url: query.photo_url ?? fromHash.photo_url,
    auth_date: query.auth_date ?? fromHash.auth_date,
    hash: query.hash ?? fromHash.hash,
  };
}
