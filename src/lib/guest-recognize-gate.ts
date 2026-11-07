/**
 * Гостевой вход: сначала форма, потом квота.
 * Пустой и не-multipart запрос не тратит 2 фото в сутки.
 */

import type { NextRequest } from "next/server";
import {
  GUEST_RECOGNIZE_LIMIT,
  GUEST_RECOGNIZE_WINDOW_MS,
  guestLimitExhaustedMessage,
} from "@/lib/guest-recognize";
import { checkRateLimitAsync } from "@/lib/rate-limit";
import {
  prepareRecognizeUpload,
  type PreparedRecognizeUpload,
} from "@/lib/recognize-upload";

export type GuestRecognizeGate =
  | { ok: true; prepared: PreparedRecognizeUpload }
  | { ok: false; status: number; error: string; retryAfterSec?: number };

export async function gateGuestRecognize(
  request: NextRequest,
  ip: string,
): Promise<GuestRecognizeGate> {
  const contentType = request.headers.get("content-type") ?? "";
  if (!contentType.toLowerCase().includes("multipart/form-data")) {
    return { ok: false, status: 400, error: "Нужен multipart с фото" };
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return { ok: false, status: 400, error: "Некорректный запрос" };
  }

  const prepared = await prepareRecognizeUpload(formData);
  if (!prepared.ok) {
    return { ok: false, status: prepared.status, error: prepared.error };
  }

  const rate = await checkRateLimitAsync(
    `recognize-guest:${ip}`,
    GUEST_RECOGNIZE_LIMIT,
    GUEST_RECOGNIZE_WINDOW_MS,
  );
  if (!rate.allowed) {
    return {
      ok: false,
      status: 429,
      error: guestLimitExhaustedMessage(),
      retryAfterSec: rate.retryAfterSec,
    };
  }

  return { ok: true, prepared: prepared.data };
}
