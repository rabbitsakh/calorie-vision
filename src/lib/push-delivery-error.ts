import { createHash } from "node:crypto";

/** Короткий отпечаток id: в лог cron не попадает сам идентификатор. */
export function pushLogUserRef(userId: string): string {
  return createHash("sha256").update(userId).digest("hex").slice(0, 8);
}

/**
 * HTTP-код из ошибки web-push. Библиотека кладёт его в statusCode,
 * а message всегда «Received unexpected response code» — без числа.
 */
export function pushHttpStatusCode(error: unknown): number | null {
  if (!error || typeof error !== "object") return null;
  const raw = (error as { statusCode?: unknown }).statusCode;
  if (typeof raw === "number" && Number.isInteger(raw) && raw >= 100 && raw <= 599) {
    return raw;
  }
  if (typeof raw === "string" && /^\d{3}$/.test(raw)) {
    const parsed = Number(raw);
    if (parsed >= 100 && parsed <= 599) return parsed;
  }
  return null;
}

/** 404 и 410 значат, что подписка на стороне push-сервиса больше не существует. */
export function isGonePushStatus(statusCode: number | null): boolean {
  return statusCode === 404 || statusCode === 410;
}

export type PushDeliveryFailure = {
  statusCode: number | null;
  dropSubscription: boolean;
  logLine: string;
};

/**
 * Безопасная строка для ответа и лога cron: код ответа, вид напоминания
 * и укороченный отпечаток пользователя. Без endpoint, ключей и текста ошибки.
 */
export function describePushDeliveryFailure(
  error: unknown,
  context: { userId: string; kind?: string },
): PushDeliveryFailure {
  const statusCode = pushHttpStatusCode(error);
  const kind = context.kind ? ` kind=${context.kind}` : "";
  const status = statusCode == null ? "unknown" : String(statusCode);
  return {
    statusCode,
    dropSubscription: isGonePushStatus(statusCode),
    logLine: `user=${pushLogUserRef(context.userId)}${kind} status=${status}`,
  };
}
