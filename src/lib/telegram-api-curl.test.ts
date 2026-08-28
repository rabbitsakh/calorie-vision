import assert from "node:assert/strict";
import { test } from "node:test";
import {
  getTelegramProxyUrl,
  telegramApiUsesCurl,
} from "./telegram-api-curl.ts";

test("getTelegramProxyUrl prefers TELEGRAM_HTTPS_PROXY", () => {
  const keys = ["TELEGRAM_HTTPS_PROXY", "HTTPS_PROXY", "HTTP_PROXY"] as const;
  const prev = Object.fromEntries(keys.map((k) => [k, process.env[k]]));
  for (const k of keys) delete process.env[k];

  process.env.TELEGRAM_HTTPS_PROXY = "socks5h://127.0.0.1:1080";
  assert.equal(getTelegramProxyUrl(), "socks5h://127.0.0.1:1080");
  assert.equal(telegramApiUsesCurl(), true);

  delete process.env.TELEGRAM_HTTPS_PROXY;
  process.env.HTTPS_PROXY = "http://proxy:8080";
  assert.equal(getTelegramProxyUrl(), "http://proxy:8080");

  for (const k of keys) {
    if (prev[k] === undefined) delete process.env[k];
    else process.env[k] = prev[k];
  }
});
