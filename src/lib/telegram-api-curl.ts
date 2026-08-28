/**
 * curl transport for Telegram Bot API — needed when api.telegram.org is blocked
 * (e.g. outbound from RU VPS) and TELEGRAM_HTTPS_PROXY is set.
 */

import { spawn } from "node:child_process";

const TELEGRAM_API = "https://api.telegram.org";

export function getTelegramProxyUrl(): string | null {
  const proxy =
    process.env.TELEGRAM_HTTPS_PROXY?.trim() ||
    process.env.HTTPS_PROXY?.trim() ||
    process.env.HTTP_PROXY?.trim();
  return proxy || null;
}

/** Force curl for all Telegram API calls (optional; proxy implies curl). */
export function telegramApiUsesCurl(): boolean {
  return Boolean(getTelegramProxyUrl()) || process.env.TELEGRAM_USE_CURL === "1";
}

export type TelegramApiJsonResult =
  | { ok: true; result: unknown }
  | { ok: false; error: string };

export async function curlTelegramApi(
  method: string,
  token: string,
  body?: Record<string, unknown>,
): Promise<TelegramApiJsonResult> {
  const url = `${TELEGRAM_API}/bot${token}/${method}`;
  const args = ["--ipv4", "-sS", "--max-time", "30", "-H", "Accept: application/json"];
  const proxy = getTelegramProxyUrl();
  if (proxy) {
    args.push("--proxy", proxy);
  }
  if (body) {
    args.push(
      "-X",
      "POST",
      "-H",
      "Content-Type: application/json",
      "-d",
      JSON.stringify(body),
      url,
    );
  } else {
    args.push(url);
  }

  return new Promise((resolve) => {
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
      resolve({ ok: false, error: error.message });
    });
    child.on("close", (code) => {
      if (code !== 0) {
        const detail = stderr.trim() || stdout.trim();
        resolve({ ok: false, error: detail || `curl exit ${code ?? "unknown"}` });
        return;
      }
      try {
        const data = JSON.parse(stdout.trim()) as {
          ok?: boolean;
          description?: string;
          result?: unknown;
        };
        if (!data.ok) {
          resolve({ ok: false, error: data.description ?? "Telegram API error" });
          return;
        }
        resolve({ ok: true, result: data.result });
      } catch {
        resolve({ ok: false, error: `Invalid JSON from curl: ${stdout.slice(0, 160)}` });
      }
    });
  });
}
