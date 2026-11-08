import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { test } from "node:test";
import {
  describePushDeliveryFailure,
  isGonePushStatus,
  pushHttpStatusCode,
  pushLogUserRef,
} from "./push-delivery-error.ts";

const USER_ID = "cm8userCuidThatMustNotLeakIntoLogs";
const ENDPOINT = "https://fcm.googleapis.com/fcm/send/super-secret-token";

function webPushError(statusCode: number, message = "Received unexpected response code") {
  return {
    name: "WebPushError",
    message,
    statusCode,
    endpoint: ENDPOINT,
    body: "expired token=abc endpoint secret",
    headers: { authorization: "Bearer vapid-secret" },
  };
}

test("statusCode читается из ошибки web-push, а не из текста", () => {
  const error = webPushError(410);
  assert.equal(pushHttpStatusCode(error), 410);
  assert.equal(error.message.includes("410"), false);
});

test("404 и 410 снимают подписку, остальные коды нет", () => {
  assert.equal(isGonePushStatus(404), true);
  assert.equal(isGonePushStatus(410), true);
  for (const code of [400, 401, 403, 413, 429, 500, 503]) {
    const failure = describePushDeliveryFailure(webPushError(code), {
      userId: USER_ID,
      kind: "unlogged_dinner",
    });
    assert.equal(failure.statusCode, code);
    assert.equal(failure.dropSubscription, false);
    assert.match(failure.logLine, new RegExp(`status=${code}`));
  }
});

test("лог cron содержит statusCode и не содержит токен, endpoint и id", () => {
  const failure = describePushDeliveryFailure(webPushError(410), {
    userId: USER_ID,
    kind: "unlogged_dinner",
  });
  const expectedRef = createHash("sha256").update(USER_ID).digest("hex").slice(0, 8);
  assert.equal(failure.dropSubscription, true);
  assert.equal(failure.logLine, `user=${expectedRef} kind=unlogged_dinner status=410`);
  assert.equal(pushLogUserRef(USER_ID), expectedRef);
  assert.equal(failure.logLine.includes(USER_ID), false);
  assert.equal(failure.logLine.includes(ENDPOINT), false);
  assert.equal(failure.logLine.includes("super-secret"), false);
  assert.equal(failure.logLine.includes("vapid-secret"), false);
  assert.equal(failure.logLine.includes("token=abc"), false);
  assert.equal(failure.logLine.includes("Received unexpected"), false);
});

test("число 410 в тексте ошибки без statusCode подписку не удаляет", () => {
  const error = new Error("connect timeout after 4100ms https://fcm.googleapis.com/fcm/send/secret");
  const failure = describePushDeliveryFailure(error, { userId: USER_ID, kind: "water" });
  assert.equal(failure.statusCode, null);
  assert.equal(failure.dropSubscription, false);
  assert.match(failure.logLine, /status=unknown/);
  assert.equal(failure.logLine.includes("fcm"), false);
  assert.equal(failure.logLine.includes("secret"), false);
  assert.equal(failure.logLine.includes(USER_ID), false);
});

test("строковый statusCode 404 считается кодом удаления", () => {
  const failure = describePushDeliveryFailure(
    { message: "Received unexpected response code", statusCode: "404" },
    { userId: USER_ID },
  );
  assert.equal(failure.statusCode, 404);
  assert.equal(failure.dropSubscription, true);
  assert.match(failure.logLine, /^user=[0-9a-f]{8} status=404$/);
});
