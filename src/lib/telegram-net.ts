/**
 * Outbound HTTPS to Telegram (oauth.telegram.org / api.telegram.org).
 *
 * Typical VPS issues:
 * 1) Broken IPv6 → Node fetch fails with "fetch failed" / ENETUNREACH
 * 2) Telegram blocked/firewalled → even IPv4 times out (curl exit 28)
 *
 * Mitigations: ipv4first DNS, curl --ipv4 fallback, optional TELEGRAM_HTTPS_PROXY.
 */

import { spawn } from "node:child_process";
import dns from "node:dns";
import https from "node:https";

let ipv4Preferred = false;

/** Prefer A records so undici/Node fetch does not hang on unreachable AAAA. */
export function preferTelegramIpv4(): void {
  if (ipv4Preferred) return;
  try {
    dns.setDefaultResultOrder("ipv4first");
    ipv4Preferred = true;
  } catch {
    // Node < 17
  }
}

/** https.Agent pinned to IPv4 — for Node https when not using curl. */
export function telegramIpv4HttpsAgent(): https.Agent {
  preferTelegramIpv4();
  return new https.Agent({ family: 4, keepAlive: true });
}

/**
 * Prefer socks5h (DNS via proxy). Plain socks5:// is upgraded so Telegram
 * hostnames resolve on the proxy side, not on a blocked VPS DNS path.
 */
export function getTelegramHttpsProxyUrl(): string | null {
  const proxy =
    process.env.TELEGRAM_HTTPS_PROXY?.trim() ||
    process.env.HTTPS_PROXY?.trim() ||
    process.env.HTTP_PROXY?.trim();
  if (!proxy) return null;
  if (/^socks5:\/\//i.test(proxy) && !/^socks5h:\/\//i.test(proxy)) {
    return proxy.replace(/^socks5:\/\//i, "socks5h://");
  }
  return proxy;
}

export function telegramUsesCurlTransport(): boolean {
  return (
    Boolean(getTelegramHttpsProxyUrl()) ||
    process.env.TELEGRAM_USE_CURL === "1" ||
    process.env.TELEGRAM_USE_CURL === "true"
  );
}

function isNetworkFetchError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  const code =
    error && typeof error === "object" && "code" in error
      ? String((error as { code?: unknown }).code ?? "")
      : "";
  let causeMessage = "";
  let causeCode = "";
  if (error instanceof Error && error.cause) {
    causeMessage = error.cause instanceof Error ? error.cause.message : String(error.cause);
    if (typeof error.cause === "object" && error.cause && "code" in error.cause) {
      causeCode = String((error.cause as { code?: unknown }).code ?? "");
    }
  }
  const blob = `${message} ${code} ${causeMessage} ${causeCode}`;
  return /fetch failed|ENETUNREACH|ECONNRESET|ETIMEDOUT|ENOTFOUND|EAI_AGAIN|ECONNREFUSED|AbortError|TimeoutError/i.test(
    blob,
  );
}

/** Short stable code for UI / logs (avoids mangling the whole error string). */
export function telegramNetworkErrorCode(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  const curlExit =
    message.match(/curl exit (\d+)/i)?.[1] ||
    message.match(/curl:\s*\((\d+)\)/i)?.[1] ||
    message.match(/\bexit(?:\s+code)?[=\s]+(\d+)/i)?.[1];
  if (curlExit === "28" || /timed?\s*out|TimeoutError|ETIMEDOUT|Failed to connect/i.test(message)) {
    return "CURL28";
  }
  if (curlExit) {
    return `CURL${curlExit}`;
  }
  if (/ENETUNREACH/i.test(message)) return "ENETUNREACH";
  if (/ENOTFOUND/i.test(message)) return "ENOTFOUND";
  if (/ECONNREFUSED/i.test(message)) return "ECONNREFUSED";
  if (/ECONNRESET/i.test(message)) return "ECONNRESET";
  if (/TELEGRAM_JWKS_HTTP_|TELEGRAM_TOKEN_HTTP_|TELEGRAM_.*_JSON/i.test(message)) {
    return "TG_HTTP";
  }
  if (/is not valid JSON|Unexpected token|JSON\.parse/i.test(message)) {
    return "TG_JSON";
  }
  if (/proxy/i.test(message)) return "PROXY";
  if (/fetch failed/i.test(message)) return "FETCH";
  const slug = message.replace(/[^A-Za-z0-9_:]/g, "").slice(0, 24);
  return slug || "UNKNOWN";
}

/** Safe snippet for UI (no secrets). */
export function telegramErrorDetail(error: unknown, maxLen = 96): string {
  const message = error instanceof Error ? error.message : String(error);
  return message.replace(/\s+/g, " ").trim().slice(0, maxLen);
}

export function telegramNetworkUserHint(error: unknown): string {
  const code = telegramNetworkErrorCode(error);
  const hasProxy = Boolean(getTelegramHttpsProxyUrl());
  if (!hasProxy) {
    return `С сервера нет доступа к Telegram [${code}]. Задайте TELEGRAM_HTTPS_PROXY=socks5://127.0.0.1:1080 (или http://…) в .env на VPS и перезапустите.`;
  }
  return `С сервера нет доступа к Telegram через прокси [${code}]. Проверьте TELEGRAM_HTTPS_PROXY и что прокси живой.`;
}

async function curlTelegramHttps(
  url: string,
  init: {
    method?: string;
    headers?: Record<string, string>;
    body?: string;
  },
): Promise<{ status: number; body: string }> {
  const maxTime = process.env.TELEGRAM_CURL_MAX_TIME?.trim() || "25";
  const args = [
    "--ipv4",
    "-sS",
    "--max-time",
    maxTime,
    "-w",
    "\n__CURL_HTTP_STATUS__:%{http_code}",
  ];
  const proxy = getTelegramHttpsProxyUrl();
  if (proxy) {
    args.push("--proxy", proxy);
  }
  const method = (init.method ?? "GET").toUpperCase();
  if (method !== "GET") {
    args.push("-X", method);
  }
  for (const [key, value] of Object.entries(init.headers ?? {})) {
    args.push("-H", `${key}: ${value}`);
  }
  if (init.body !== undefined) {
    args.push("--data-binary", init.body);
  }
  args.push(url);

  return new Promise((resolve, reject) => {
    const child = spawn("curl", args, { stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk: Buffer | string) => {
      stdout += chunk.toString();
    });
    child.stderr.on("data", (chunk: Buffer | string) => {
      stderr += chunk.toString();
    });
    child.on("error", (error) => {
      reject(error);
    });
    child.on("close", (code) => {
      if (code !== 0) {
        const detail = stderr.trim() || stdout.trim() || "curl failed";
        reject(new Error(`${detail} (curl exit ${code ?? "unknown"})`));
        return;
      }
      const marker = "\n__CURL_HTTP_STATUS__:";
      const idx = stdout.lastIndexOf(marker);
      if (idx < 0) {
        reject(new Error("curl: missing status marker"));
        return;
      }
      const body = stdout.slice(0, idx);
      const status = Number(stdout.slice(idx + marker.length).trim());
      if (!Number.isFinite(status)) {
        reject(new Error("curl: invalid status"));
        return;
      }
      resolve({ status, body });
    });
  });
}

function responseFromCurl(result: { status: number; body: string }): Response {
  return new Response(result.body, {
    status: result.status,
    headers: { "Content-Type": "application/json" },
  });
}

function normalizeRequestParts(init?: RequestInit): {
  method: string;
  headers: Record<string, string>;
  body?: string;
} {
  const method = init?.method ?? "GET";
  const headers: Record<string, string> = {};
  if (init?.headers) {
    const h = new Headers(init.headers);
    h.forEach((value, key) => {
      headers[key] = value;
    });
  }
  const body =
    typeof init?.body === "string"
      ? init.body
      : init?.body instanceof URLSearchParams
        ? init.body.toString()
        : init?.body != null
          ? String(init.body)
          : undefined;
  return { method, headers, body };
}

/**
 * HTTPS fetch to Telegram.
 * - With TELEGRAM_HTTPS_PROXY / TELEGRAM_USE_CURL → curl --ipv4 [--proxy] immediately
 * - Else Node fetch (ipv4first) with short timeout, then curl --ipv4 fallback
 */
export async function fetchTelegramHttps(
  url: string,
  init?: RequestInit,
): Promise<Response> {
  preferTelegramIpv4();
  const parts = normalizeRequestParts(init);

  if (telegramUsesCurlTransport()) {
    const curlResult = await curlTelegramHttps(url, parts);
    return responseFromCurl(curlResult);
  }

  const fetchTimeoutMs = Number(process.env.TELEGRAM_FETCH_TIMEOUT_MS ?? 8_000);
  try {
    return await fetch(url, {
      ...init,
      cache: "no-store",
      signal: AbortSignal.timeout(Number.isFinite(fetchTimeoutMs) ? fetchTimeoutMs : 8_000),
    });
  } catch (error) {
    if (!isNetworkFetchError(error)) {
      throw error;
    }

    try {
      const curlResult = await curlTelegramHttps(url, parts);
      return responseFromCurl(curlResult);
    } catch (curlError) {
      const fetchMsg = error instanceof Error ? error.message : String(error);
      const curlMsg = curlError instanceof Error ? curlError.message : String(curlError);
      // Keep curl exit code visible for telegramNetworkErrorCode()
      throw new Error(`fetch failed; curl: ${curlMsg}; fetch: ${fetchMsg}`);
    }
  }
}
