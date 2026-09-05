import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { fetchTelegramHttps, preferTelegramIpv4 } from "./telegram-net.ts";

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
