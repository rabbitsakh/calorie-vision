import { checkRateLimitAsync } from "@/lib/rate-limit";

/** Per-user assistant chat/stream limit. */
export async function checkAssistantChatLimit(userId: string) {
  return checkRateLimitAsync(`assistant-chat:${userId}`, 24, 60_000);
}

/** Apply / undo / photo confirm. */
export async function checkAssistantWriteLimit(userId: string) {
  return checkRateLimitAsync(`assistant-write:${userId}`, 40, 60_000);
}

export function rateLimitResponse(retryAfterSec: number) {
  return {
    error: `Слишком много запросов к ассистенту. Подождите ${retryAfterSec} сек.`,
    retryAfterSec,
  };
}
