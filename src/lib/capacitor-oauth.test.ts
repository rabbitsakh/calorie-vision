import assert from "node:assert/strict";
import test from "node:test";
import {
  isNativeBridgeUrl,
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

test("parses custom-scheme handoff", () => {
  const url = "calorievision://native-bridge?token=abc%2Fdef";
  assert.equal(isNativeBridgeUrl(url), true);
  assert.equal(tokenFromNativeBridgeUrl(url), "abc/def");
});

test("parses intent handoff", () => {
  const url = nativeBridgeIntentUrl("xyz");
  assert.equal(tokenFromNativeBridgeUrl(url), "xyz");
});
