/**
 * Outbound HTTPS to Telegram (oauth.telegram.org / api.telegram.org).
 * Many VPS have broken IPv6 — Node fetch then fails with "fetch failed" / ENETUNREACH.
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

/** https.Agent pinned to IPv4 — for jose createRemoteJWKSet and Node https. */
export function telegramIpv4HttpsAgent(): https.Agent {
  preferTelegramIpv4();
  return new https.Agent({ family: 4, keepAlive: true });
}

export function getTelegramHttpsProxyUrl(): string | null {
  const proxy =
    process.env.TELEGRAM_HTTPS_PROXY?.trim() ||
    process.env.HTTPS_PROXY?.trim() ||
    process.env.HTTP_PROXY?.trim();
  return proxy || null;
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
  return /fetch failed|ENETUNREACH|ECONNRESET|ETIMEDOUT|ENOTFOUND|EAI_AGAIN|ECONNREFUSED/i.test(
    blob,
  );
}

async function curlTelegramHttps(
  url: string,
  init: {
    method?: string;
    headers?: Record<string, string>;
    body?: string;
  },
): Promise<{ status: number; body: string }> {
  const args = [
    "--ipv4",
    "-sS",
    "--max-time",
    "30",
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
        reject(new Error(stderr.trim() || stdout.trim() || `curl exit ${code ?? "unknown"}`));
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

/**
 * HTTPS fetch to Telegram with IPv4 preference and curl --ipv4 fallback.
 * Returns a Response-like object compatible with response.ok / .json() / .text().
 */
export async function fetchTelegramHttps(
  url: string,
  init?: RequestInit,
): Promise<Response> {
  preferTelegramIpv4();

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

  try {
    return await fetch(url, {
      ...init,
      // undici ignores custom agents; ipv4first DNS is the main fix for global fetch.
      cache: "no-store",
    });
  } catch (error) {
    if (!isNetworkFetchError(error)) {
      throw error;
    }

    try {
      const curlResult = await curlTelegramHttps(url, { method, headers, body });
      return new Response(curlResult.body, {
        status: curlResult.status,
        headers: { "Content-Type": "application/json" },
      });
    } catch (curlError) {
      const fetchMsg = error instanceof Error ? error.message : String(error);
      const curlMsg = curlError instanceof Error ? curlError.message : String(curlError);
      throw new Error(`fetch failed (ipv4/curl): ${fetchMsg}; curl: ${curlMsg}`);
    }
  }
}
