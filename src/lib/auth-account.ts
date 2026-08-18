const ACCOUNT_FIELDS = [
  "userId",
  "type",
  "provider",
  "providerAccountId",
  "refresh_token",
  "access_token",
  "expires_at",
  "token_type",
  "scope",
  "id_token",
  "session_state",
] as const;

export function sanitizeAdapterAccount(data: Record<string, unknown>): Record<string, unknown> {
  const account: Record<string, unknown> = {};

  for (const key of ACCOUNT_FIELDS) {
    if (data[key] !== undefined && data[key] !== "") {
      account[key] = data[key];
    }
  }

  if (
    account.expires_at === undefined &&
    typeof data.expires_in === "number" &&
    Number.isFinite(data.expires_in)
  ) {
    account.expires_at = Math.floor(Date.now() / 1000) + Math.max(0, Math.round(data.expires_in));
  }

  if (typeof account.expires_at === "number") {
    account.expires_at = Math.round(account.expires_at);
  }

  return account;
}

export function sanitizeAdapterUser(data: Record<string, unknown>): {
  name?: string;
  email: string | null;
  image?: string;
  emailVerified: Date | null;
} {
  const email = typeof data.email === "string" ? data.email.trim().toLowerCase() : "";

  return {
    name: typeof data.name === "string" && data.name.trim() ? data.name.trim() : undefined,
    email: email || null,
    image: typeof data.image === "string" && data.image.trim() ? data.image.trim() : undefined,
    emailVerified: data.emailVerified instanceof Date ? data.emailVerified : null,
  };
}
