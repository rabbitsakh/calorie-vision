import assert from "node:assert/strict";
import test from "node:test";
import {
  isNativeBridgeUrl,
  nativeBridgeAppReturnUrl,
  nativeBridgeConsumeUrl,
  nativeBridgeIntentUrl,
  tokenFromNativeBridgeUrl,
} from "./native-auth-bridge.ts";

test("consume URL builds with token", () => {
  assert.equal(
    nativeBridgeConsumeUrl("https://calorievision.ru", "tok"),
    "https://calorievision.ru/api/auth/native-bridge/consume?token=tok",
  );
});

test("app return fallback never points at consume", () => {
  const fallback = nativeBridgeAppReturnUrl("https://calorievision.ru", "tok");
  assert.equal(fallback, "https://calorievision.ru/auth/native-bridge/return?token=tok");
  const intent = nativeBridgeIntentUrl("xyz");
  assert.equal(decodeURIComponent(intent).includes("/auth/native-bridge/return?token=xyz"), true);
  assert.equal(intent.includes("consume"), false);
});

test("parses custom-scheme handoff", () => {
  const url = "calorievision://native-bridge?token=abc%2Fdef";
  assert.equal(isNativeBridgeUrl(url), true);
  assert.equal(tokenFromNativeBridgeUrl(url), "abc/def");
});

test("parses intent handoff", () => {
  const url = nativeBridgeIntentUrl("xyz");
  assert.equal(tokenFromNativeBridgeUrl(url), "xyz");
});

test("capacitor allowNavigation list covers IdP hosts used by login", async () => {
  // Keep in sync with capacitor.config.ts — HostMask needs equal label depth for wildcards.
  const { default: config } = await import("../../capacitor.config.ts");
  const allow = config.server?.allowNavigation ?? [];
  for (const host of [
    "calorievision.ru",
    "*.calorievision.ru",
    "accounts.google.com",
    "*.google.com",
    "oauth.yandex.ru",
    "*.yandex.ru",
    "id.vk.ru",
    "*.vk.ru",
    "oauth.telegram.org",
    "*.telegram.org",
  ]) {
    assert.ok(allow.includes(host), `missing allowNavigation entry: ${host}`);
  }
  assert.equal(config.server?.errorPath, "offline.html");
});
