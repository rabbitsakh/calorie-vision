import { createHash, createHmac, timingSafeEqual } from "crypto";

export type TelegramAuthPayload = {
  id: string | number;
  first_name?: string;
  last_name?: string;
  username?: string;
  photo_url?: string;
  auth_date: string | number;
  hash: string;
};

/** Max age of Telegram Login Widget auth_date (Telegram recommends checking freshness). */
export const TELEGRAM_AUTH_MAX_AGE_SEC = 24 * 60 * 60;

/**
 * Verify Telegram Login Widget payload.
 * @see https://core.telegram.org/widgets/login#checking-authorization
 */
export function verifyTelegramAuth(
  data: TelegramAuthPayload,
  botToken: string,
  maxAgeSec = TELEGRAM_AUTH_MAX_AGE_SEC,
  nowSec = Math.floor(Date.now() / 1000),
): boolean {
  const hash = data.hash?.trim();
  if (!hash || !botToken) {
    return false;
  }

  const authDate = Number(data.auth_date);
  if (!Number.isFinite(authDate) || nowSec - authDate > maxAgeSec || authDate > nowSec + 60) {
    return false;
  }

  const fields: Record<string, string> = {};
  for (const [key, value] of Object.entries(data)) {
    if (key === "hash" || value === undefined || value === null || value === "") {
      continue;
    }
    fields[key] = String(value);
  }

  const checkString = Object.keys(fields)
    .sort()
    .map((key) => `${key}=${fields[key]}`)
    .join("\n");

  const secretKey = createHash("sha256").update(botToken).digest();
  const computed = createHmac("sha256", secretKey).update(checkString).digest("hex");

  try {
    const left = Buffer.from(computed, "hex");
    const right = Buffer.from(hash, "hex");
    if (left.length !== right.length) {
      return false;
    }
    return timingSafeEqual(left, right);
  } catch {
    return false;
  }
}

export function telegramDisplayName(data: TelegramAuthPayload): string {
  const full = [data.first_name, data.last_name].filter(Boolean).join(" ").trim();
  if (full) {
    return full;
  }
  if (data.username) {
    return data.username;
  }
  return "Telegram";
}
