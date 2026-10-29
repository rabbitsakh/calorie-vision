/**
 * Soft daily photo-recognition quota (free vs Pro).
 * Burst rate-limit stays separate in the recognize routes.
 *
 * Env:
 * - CV_RECOGNIZE_DAILY_FREE — free photos / UTC day (default 20)
 * - CV_PRO_USER_IDS — comma-separated user ids with unlimited photos
 * - CV_PRO_EMAILS — comma-separated emails with unlimited photos
 */

import { checkRateLimitAsync, type RateLimitResult } from "@/lib/rate-limit";

export const DEFAULT_DAILY_FREE_PHOTOS = 20;
const DAY_MS = 24 * 60 * 60_000;

export type RecognizeQuotaSnapshot = {
  isPro: boolean;
  limit: number | null;
  /** True when this request may proceed. */
  allowed: boolean;
  retryAfterSec: number;
  code?: "DAILY_PHOTO_LIMIT";
};

function parseList(raw: string | undefined): Set<string> {
  if (!raw?.trim()) return new Set();
  return new Set(
    raw
      .split(",")
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean),
  );
}

export function freeDailyPhotoLimit(): number {
  const raw = process.env.CV_RECOGNIZE_DAILY_FREE?.trim();
  if (!raw) return DEFAULT_DAILY_FREE_PHOTOS;
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 1) return DEFAULT_DAILY_FREE_PHOTOS;
  return Math.min(500, Math.floor(n));
}

export function isProRecognizeUser(input: {
  userId: string;
  email?: string | null;
}): boolean {
  const ids = parseList(process.env.CV_PRO_USER_IDS);
  if (ids.has(input.userId.toLowerCase())) return true;
  const email = input.email?.trim().toLowerCase();
  if (!email) return false;
  const emails = parseList(process.env.CV_PRO_EMAILS);
  return emails.has(email);
}

export function dailyQuotaKey(userId: string, nowMs = Date.now()): string {
  const day = Math.floor(nowMs / DAY_MS);
  return `recognize-day:${userId}:${day}`;
}

export async function checkDailyRecognizeQuota(input: {
  userId: string;
  email?: string | null;
  nowMs?: number;
}): Promise<RecognizeQuotaSnapshot> {
  const nowMs = input.nowMs ?? Date.now();
  if (isProRecognizeUser(input)) {
    return { isPro: true, limit: null, allowed: true, retryAfterSec: 0 };
  }
  const limit = freeDailyPhotoLimit();
  const rate: RateLimitResult = await checkRateLimitAsync(
    dailyQuotaKey(input.userId, nowMs),
    limit,
    DAY_MS,
    nowMs,
  );
  if (!rate.allowed) {
    return {
      isPro: false,
      limit,
      allowed: false,
      retryAfterSec: rate.retryAfterSec,
      code: "DAILY_PHOTO_LIMIT",
    };
  }
  return { isPro: false, limit, allowed: true, retryAfterSec: 0 };
}

export function dailyQuotaErrorBody(quota: RecognizeQuotaSnapshot) {
  const limit = quota.limit ?? freeDailyPhotoLimit();
  return {
    error: `Дневной лимит фото: ${limit}. Завтра снова, или подключите Pro — без дневного потолка.`,
    code: "DAILY_PHOTO_LIMIT" as const,
    retryAfterSec: quota.retryAfterSec,
    quota: {
      isPro: false,
      limit,
      remaining: 0,
    },
    proHint: true,
  };
}

export const PHOTO_SCALE_TIP =
  "Положите рядом вилку или карту — так точнее порция и калории.";

export const PHOTO_SCALE_TIP_SHORT = "Рядом вилка или карта — точнее порция.";
