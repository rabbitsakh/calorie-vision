import { GigaChatApiError, sleep } from "@/lib/ai/gigachat-errors";

/** Default per-request budget. Recognition stays inside the nginx ~180s window even with retries. */
export const DEFAULT_GIGACHAT_HTTP_TIMEOUT_MS = 25_000;

const RETRYABLE_NETWORK_CODES = new Set([
  "ECONNRESET",
  "ECONNREFUSED",
  "EAI_AGAIN",
  "ETIMEDOUT",
  "EPIPE",
  "UND_ERR_CONNECT_TIMEOUT",
  "UND_ERR_SOCKET",
]);

/**
 * Exponential backoff: attempt 0 → base, attempt 1 → 2×base, attempt 2 → 4×base.
 * With the default base (1200ms) the first two waits match the previous linear schedule
 * (1.2s, 2.4s) so existing 3-attempt recognition timing stays the same.
 */
export function gigachatRetryDelayMs(attempt: number, baseMs = 1200): number {
  const safeAttempt = Math.max(0, attempt);
  const safeBase = baseMs > 0 ? baseMs : 1200;
  return Math.min(safeBase * 2 ** safeAttempt, 15_000);
}

export function resolveGigaChatHttpTimeoutMs(
  raw: string | undefined = process.env.GIGACHAT_HTTP_TIMEOUT_MS,
  fallback = DEFAULT_GIGACHAT_HTTP_TIMEOUT_MS,
): number {
  const trimmed = raw?.trim();
  if (!trimmed) return fallback;
  const parsed = Number(trimmed);
  if (!Number.isFinite(parsed) || parsed < 1000) return fallback;
  return Math.min(120_000, Math.floor(parsed));
}

export function isRetryableGigaChatError(error: unknown): boolean {
  if (error instanceof GigaChatApiError) {
    return error.status === 408 || error.status === 429 || error.status >= 500;
  }

  if (error && typeof error === "object" && "code" in error) {
    const code = String((error as { code?: unknown }).code ?? "");
    if (RETRYABLE_NETWORK_CODES.has(code)) return true;
  }

  if (error instanceof Error && /timeout|timed out|socket hang up|econnreset/i.test(error.message)) {
    return true;
  }

  return false;
}

/**
 * Retry transient recognition failures (429, 5xx, timeout, dropped socket).
 * Client errors (400/401/403/413) are not retried.
 */
export async function withGigaChatRetry<T>(
  run: () => Promise<T>,
  options?: {
    attempts?: number;
    baseDelayMs?: number;
    sleepFn?: (ms: number) => Promise<void>;
  },
): Promise<T> {
  const attempts = Math.max(1, options?.attempts ?? 3);
  const sleepFn = options?.sleepFn ?? sleep;
  let lastError: unknown;

  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      return await run();
    } catch (error) {
      lastError = error;
      if (!isRetryableGigaChatError(error) || attempt === attempts - 1) {
        throw error;
      }
      await sleepFn(gigachatRetryDelayMs(attempt, options?.baseDelayMs));
    }
  }

  throw lastError;
}
