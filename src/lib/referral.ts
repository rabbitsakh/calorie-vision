import { createHmac, timingSafeEqual } from "crypto";
import { withBasePath } from "@/lib/paths";

const CODE_LEN = 12;

function referralSecret(): string {
  return process.env.NEXTAUTH_SECRET?.trim() || process.env.REFERRAL_SECRET?.trim() || "dev-referral";
}

/** Stable opaque code derived from user id (not reversible without the secret). */
export function referralCodeForUser(userId: string): string {
  const id = userId.trim();
  if (!id) {
    return "";
  }
  return createHmac("sha256", referralSecret())
    .update(`ref:${id}`)
    .digest("base64url")
    .slice(0, CODE_LEN);
}

export function referralCodesMatch(userId: string, code: string): boolean {
  const expected = referralCodeForUser(userId);
  const got = code.trim();
  if (!expected || got.length !== expected.length) {
    return false;
  }
  try {
    return timingSafeEqual(Buffer.from(expected), Buffer.from(got));
  } catch {
    return false;
  }
}

/** Absolute or site-relative invite URL with `?ref=` code. */
export function buildReferralShareUrl(code: string, origin?: string): string {
  const path = withBasePath(`/?ref=${encodeURIComponent(code)}`);
  if (origin?.trim()) {
    return `${origin.replace(/\/$/, "")}${path}`;
  }
  return path;
}

export function telegramShareUrl(url: string, text: string): string {
  const params = new URLSearchParams({ url, text });
  return `https://t.me/share/url?${params.toString()}`;
}

export function vkShareUrl(url: string): string {
  const params = new URLSearchParams({ url });
  return `https://vk.com/share.php?${params.toString()}`;
}
