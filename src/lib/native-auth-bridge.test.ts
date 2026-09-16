import assert from "node:assert/strict";
import test from "node:test";
import {
  NATIVE_BRIDGE_HOST,
  NATIVE_BRIDGE_SCHEME,
  createNativeBridgeToken,
  isNativeBridgeUrl,
  nativeBridgeDeepLink,
  tokenFromNativeBridgeUrl,
  verifyNativeBridgeToken,
} from "./native-auth-bridge.ts";

test("deep link format", () => {
  const link = nativeBridgeDeepLink("abc");
  assert.equal(link.startsWith(`${NATIVE_BRIDGE_SCHEME}://${NATIVE_BRIDGE_HOST}?token=`), true);
  assert.equal(tokenFromNativeBridgeUrl(link), "abc");
  assert.equal(isNativeBridgeUrl(link), true);
});

test("round-trip bridge token", async () => {
  process.env.NEXTAUTH_SECRET = "test-secret-native-bridge";
  const token = await createNativeBridgeToken("user-42");
  assert.equal(await verifyNativeBridgeToken(token), "user-42");
  assert.equal(await verifyNativeBridgeToken("not-a-jwt"), null);
});

test("isNativeBridgeUrl for consume path", () => {
  assert.equal(
    isNativeBridgeUrl("https://calorievision.ru/api/auth/native-bridge/consume?token=x"),
    true,
  );
  assert.equal(isNativeBridgeUrl("https://calorievision.ru/login"), false);
});
