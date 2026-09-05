import { createHmac, timingSafeEqual } from "crypto";

export type TelegramLoginTicketPayload = {
  id: string;
  first_name?: string;
  last_name?: string;
  username?: string;
  photo_url?: string;
  phone_number?: string;
  exp: number;
};

function ticketSecret(): string {
  const secret = process.env.NEXTAUTH_SECRET?.trim();
  if (!secret) {
    throw new Error("NEXTAUTH_SECRET is required for Telegram OIDC tickets");
  }
  return secret;
}

/** Short-lived signed ticket so the client can finish Credentials sign-in. */
export function createTelegramLoginTicket(
  payload: Omit<TelegramLoginTicketPayload, "exp">,
  maxAgeSec = 5 * 60,
): string {
  const body: TelegramLoginTicketPayload = {
    ...payload,
    exp: Math.floor(Date.now() / 1000) + maxAgeSec,
  };
  const json = Buffer.from(JSON.stringify(body), "utf8").toString("base64url");
  const sig = createHmac("sha256", ticketSecret()).update(json).digest("base64url");
  return `${json}.${sig}`;
}

export function verifyTelegramLoginTicket(ticket: string): TelegramLoginTicketPayload | null {
  const trimmed = ticket.trim();
  const dot = trimmed.lastIndexOf(".");
  if (dot <= 0) {
    return null;
  }

  const json = trimmed.slice(0, dot);
  const sig = trimmed.slice(dot + 1);
  if (!json || !sig) {
    return null;
  }

  const expected = createHmac("sha256", ticketSecret()).update(json).digest("base64url");
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    return null;
  }

  try {
    const payload = JSON.parse(
      Buffer.from(json, "base64url").toString("utf8"),
    ) as TelegramLoginTicketPayload;
    if (!payload?.id || typeof payload.exp !== "number") {
      return null;
    }
    if (payload.exp < Math.floor(Date.now() / 1000)) {
      return null;
    }
    return payload;
  } catch {
    return null;
  }
}
