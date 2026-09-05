import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  fetchTelegramHttps,
  preferTelegramIpv4,
  telegramNetworkErrorCode,
  telegramNetworkUserHint,
  telegramUsesCurlTransport,
} from "./telegram-net.ts";

describe("telegram-net IPv4 fetch", () => {
  it("fetches Telegram OIDC JWKS over IPv4", async () => {
    preferTelegramIpv4();
    const response = await fetchTelegramHttps(
      "https://oauth.telegram.org/.well-known/jwks.json",
    );
    assert.equal(response.ok, true);
    const json = (await response.json()) as { keys?: unknown[] };
    assert.ok(Array.isArray(json.keys));
    assert.ok((json.keys?.length ?? 0) > 0);
  });
});

describe("telegram-net error hints", () => {
  it("maps curl timeout to CURL28 and asks for proxy", () => {
    delete process.env.TELEGRAM_HTTPS_PROXY;
    delete process.env.HTTPS_PROXY;
    delete process.env.HTTP_PROXY;
    const err = new Error("curl: (28) Failed to connect (curl exit 28)");
    assert.equal(telegramNetworkErrorCode(err), "CURL28");
    assert.match(telegramNetworkUserHint(err), /TELEGRAM_HTTPS_PROXY/);
  });

  it("detects curl transport when proxy is set", () => {
    process.env.TELEGRAM_HTTPS_PROXY = "socks5://127.0.0.1:1080";
    assert.equal(telegramUsesCurlTransport(), true);
    delete process.env.TELEGRAM_HTTPS_PROXY;
  });
});
