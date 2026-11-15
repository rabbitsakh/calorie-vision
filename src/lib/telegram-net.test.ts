import assert from "node:assert/strict";
import { chmodSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it } from "node:test";
import { gzipSync } from "node:zlib";
import {
  fetchTelegramHttps,
  preferTelegramIpv4,
  telegramNetworkErrorCode,
  telegramNetworkUserHint,
  telegramUsesCurlTransport,
} from "./telegram-net.ts";

const CURL_ENV_KEYS = [
  "PATH",
  "TELEGRAM_USE_CURL",
  "TELEGRAM_HTTPS_PROXY",
  "HTTPS_PROXY",
  "HTTP_PROXY",
] as const;

function snapshotCurlEnv(): Record<(typeof CURL_ENV_KEYS)[number], string | undefined> {
  return {
    PATH: process.env.PATH,
    TELEGRAM_USE_CURL: process.env.TELEGRAM_USE_CURL,
    TELEGRAM_HTTPS_PROXY: process.env.TELEGRAM_HTTPS_PROXY,
    HTTPS_PROXY: process.env.HTTPS_PROXY,
    HTTP_PROXY: process.env.HTTP_PROXY,
  };
}

function restoreCurlEnv(saved: Record<(typeof CURL_ENV_KEYS)[number], string | undefined>): void {
  for (const key of CURL_ENV_KEYS) {
    const value = saved[key];
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
}

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

describe("telegram-net curl compressed", () => {
  it("passes --compressed to curl when the proxy transport is used", async () => {
    const dir = mkdtempSync(join(tmpdir(), "tg-curl-"));
    const argsFile = join(dir, "args");
    const curlBin = join(dir, "curl");
    writeFileSync(
      curlBin,
      [
        "#!/bin/sh",
        `printf '%s\\n' "$@" > ${JSON.stringify(argsFile)}`,
        "printf '\\n__CURL_HTTP_STATUS__:200'",
        "",
      ].join("\n"),
    );
    chmodSync(curlBin, 0o755);

    const saved = snapshotCurlEnv();
    process.env.PATH = `${dir}:${saved.PATH ?? ""}`;
    delete process.env.TELEGRAM_USE_CURL;
    delete process.env.HTTPS_PROXY;
    delete process.env.HTTP_PROXY;
    process.env.TELEGRAM_HTTPS_PROXY = "socks5://127.0.0.1:1080";

    try {
      assert.equal(telegramUsesCurlTransport(), true);
      const response = await fetchTelegramHttps(
        "https://oauth.telegram.org/.well-known/jwks.json",
        { method: "GET" },
      );
      assert.equal(response.status, 200);
      const args = readFileSync(argsFile, "utf8").split("\n").filter((line) => line.length > 0);
      assert.ok(args.includes("--compressed"));
      assert.equal(args[args.indexOf("--proxy") + 1], "socks5h://127.0.0.1:1080");
      assert.equal(args.at(-1), "https://oauth.telegram.org/.well-known/jwks.json");
    } finally {
      restoreCurlEnv(saved);
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("fetch path inflates a gzip body when curl is not used", async () => {
    const saved = snapshotCurlEnv();
    delete process.env.TELEGRAM_USE_CURL;
    delete process.env.TELEGRAM_HTTPS_PROXY;
    delete process.env.HTTPS_PROXY;
    delete process.env.HTTP_PROXY;

    const payload = JSON.stringify({ keys: [{ kty: "OKP", kid: "gzip-test" }] });
    const gz = gzipSync(Buffer.from(payload));
    assert.equal(gz.subarray(0, 2).toString("hex"), "1f8b");

    let userAgent = "";
    const server = createServer((req, res) => {
      userAgent = String(req.headers["user-agent"] ?? "");
      res.writeHead(200, {
        "Content-Type": "application/json",
        "Content-Encoding": "gzip",
        "Content-Length": String(gz.length),
      });
      res.end(gz);
    });

    await new Promise<void>((resolve) => {
      server.listen(0, "127.0.0.1", () => resolve());
    });
    const port = (server.address() as AddressInfo).port;

    try {
      assert.equal(telegramUsesCurlTransport(), false);
      const response = await fetchTelegramHttps(`http://127.0.0.1:${port}/.well-known/jwks.json`);
      assert.equal(response.ok, true);
      assert.doesNotMatch(userAgent, /curl/i);
      const json = (await response.json()) as { keys?: Array<{ kid?: string }> };
      assert.equal(json.keys?.[0]?.kid, "gzip-test");
    } finally {
      server.closeAllConnections();
      await new Promise<void>((resolve) => server.close(() => resolve()));
      restoreCurlEnv(saved);
    }
  });
});

describe("telegram-net proxy URL", () => {
  it("upgrades socks5:// to socks5h://", async () => {
    const { getTelegramHttpsProxyUrl } = await import("./telegram-net.ts");
    process.env.TELEGRAM_HTTPS_PROXY = "socks5://PsR1G9:secret@77.83.187.153:8000";
    assert.equal(
      getTelegramHttpsProxyUrl(),
      "socks5h://PsR1G9:secret@77.83.187.153:8000",
    );
    delete process.env.TELEGRAM_HTTPS_PROXY;
  });

  it("does not use FETCH as a catch-all code", async () => {
    const { telegramNetworkErrorCode } = await import("./telegram-net.ts");
    assert.equal(telegramNetworkErrorCode(new Error("prisma unique constraint")), "prismauniqueconstraint");
    assert.equal(telegramNetworkErrorCode(new Error("fetch failed")), "FETCH");
  });
});
