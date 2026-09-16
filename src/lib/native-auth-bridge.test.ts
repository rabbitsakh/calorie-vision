import assert from "node:assert/strict";
import test from "node:test";
import {
  NATIVE_BRIDGE_HOST,
  NATIVE_BRIDGE_PACKAGE,
  NATIVE_BRIDGE_SCHEME,
  createNativeBridgeToken,
  isNativeBridgeUrl,
  nativeBridgeDeepLink,
  nativeBridgeIntentUrl,
  tokenFromNativeBridgeUrl,
  verifyNativeBridgeToken,
} from "./native-auth-bridge.ts";

test("deep link format", () => {
  const link = nativeBridgeDeepLink("abc");
  assert.equal(link.startsWith(`${NATIVE_BRIDGE_SCHEME}://${NATIVE_BRIDGE_HOST}?token=`), true);
  assert.equal(tokenFromNativeBridgeUrl(link), "abc");
  assert.equal(isNativeBridgeUrl(link), true);
});

test("intent URL targets package and scheme", () => {
  const url = nativeBridgeIntentUrl("tok");
  assert.equal(url.includes(`scheme=${NATIVE_BRIDGE_SCHEME}`), true);
  assert.equal(url.includes(`package=${NATIVE_BRIDGE_PACKAGE}`), true);
  assert.equal(tokenFromNativeBridgeUrl(url), "tok");
  assert.equal(isNativeBridgeUrl(url), true);
});

test("round-trip compact bridge token", async () => {
  process.env.NEXTAUTH_SECRET = "test-secret-native-bridge";
  const token = await createNativeBridgeToken("user-42");
  assert.ok(token.length < 200, `token too long for intents: ${token.length}`);
  assert.equal(await verifyNativeBridgeToken(token), "user-42");
  assert.equal(await verifyNativeBridgeToken("not-a-token"), null);
});

test("isNativeBridgeUrl for consume path", () => {
  assert.equal(
    isNativeBridgeUrl("https://calorievision.ru/api/auth/native-bridge/consume?token=x"),
    true,
  );
  assert.equal(isNativeBridgeUrl("https://calorievision.ru/login"), false);
});
