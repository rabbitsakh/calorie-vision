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
