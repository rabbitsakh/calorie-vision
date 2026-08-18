import assert from "node:assert/strict";
import { test } from "node:test";
import {
  applyVkCallbackToSearchParams,
  buildVkTokenRequestBody,
  getVkRedirectUri,
  parseVkCallbackParams,
  takeVkDeviceId,
  vkProfileToUser,
} from "./vk-auth.ts";

test("reads VK callback query params", () => {
  const parsed = parseVkCallbackParams({
    code: "code-1",
    state: "state-1",
    device_id: "device-1",
  });
  assert.deepEqual(parsed, { code: "code-1", state: "state-1", deviceId: "device-1" });
});

test("reads VK callback payload JSON used by VK ID", () => {
  const parsed = parseVkCallbackParams({
    payload: JSON.stringify({
      code: "code-2",
      state: "state-2",
      type: "code_v2",
      device_id: "device-2",
    }),
  });
  assert.deepEqual(parsed, { code: "code-2", state: "state-2", deviceId: "device-2" });
});

test("maps a VK ID profile to a NextAuth user", () => {
  assert.deepEqual(
    vkProfileToUser({
      user: {
        user_id: 123,
        first_name: "Иван",
        last_name: "Иванов",
        email: "ivan@vk.ru",
        avatar: "https://example.com/a.png",
      },
    }),
    {
      id: "123",
      name: "Иван Иванов",
      email: "ivan@vk.ru",
      image: "https://example.com/a.png",
    },
  );
});

test("sends device_id and state when exchanging the VK code", () => {
  const body = buildVkTokenRequestBody({
    code: "abc",
    codeVerifier: "verifier",
    clientId: "7915193",
    clientSecret: "secret",
    redirectUri: "https://calorievision.ru/api/auth/callback/vk",
    deviceId: "device-9",
    state: "state-9",
  });

  assert.equal(body.get("grant_type"), "authorization_code");
  assert.equal(body.get("device_id"), "device-9");
  assert.equal(body.get("state"), "state-9");
  assert.equal(body.get("client_secret"), "secret");
  assert.equal(body.get("service_token"), "secret");
  assert.equal(body.get("redirect_uri"), "https://calorievision.ru/api/auth/callback/vk");
});

test("builds the VK redirect URI from NEXTAUTH_URL", () => {
  assert.equal(
    getVkRedirectUri("https://calorievision.ru"),
    "https://calorievision.ru/api/auth/callback/vk",
  );
  assert.equal(
    getVkRedirectUri("https://calorievision.ru/api/auth"),
    "https://calorievision.ru/api/auth/callback/vk",
  );
});

test("unpacks VK payload and stashes device_id before NextAuth strips it", () => {
  const incoming = new URLSearchParams({
    payload: JSON.stringify({
      code: "code-3",
      state: "state-3",
      type: "code_v2",
      device_id: "device-3",
    }),
  });

  const flattened = applyVkCallbackToSearchParams(incoming);
  assert.equal(flattened.get("code"), "code-3");
  assert.equal(flattened.get("state"), "state-3");
  assert.equal(flattened.get("payload"), null);
  assert.equal(flattened.get("device_id"), null);
  assert.equal(takeVkDeviceId("state-3"), "device-3");
  assert.equal(takeVkDeviceId("state-3"), "");
});

test("stashes device_id from a plain query callback", () => {
  const flattened = applyVkCallbackToSearchParams(
    new URLSearchParams({
      code: "code-4",
      state: "state-4",
      device_id: "device-4",
    }),
  );
  assert.equal(flattened.get("code"), "code-4");
  assert.equal(flattened.get("device_id"), null);
  assert.equal(takeVkDeviceId("state-4"), "device-4");
});
