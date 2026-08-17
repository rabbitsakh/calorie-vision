import assert from "node:assert/strict";
import { test } from "node:test";
import { getSmsRuSendError } from "./sms-response.ts";

test("accepts a successful sms.ru send", () => {
  assert.equal(
    getSmsRuSendError({
      status: "OK",
      status_code: 100,
      sms: {
        "79001234567": { status: "OK", status_code: 100 },
      },
    }),
    null,
  );
});

test("surfaces top-level sms.ru errors", () => {
  assert.equal(
    getSmsRuSendError({
      status: "ERROR",
      status_code: 200,
      status_text: "Неправильный api_id",
    }),
    "Неправильный api_id",
  );
});

test("surfaces per-number sms.ru errors that used to look like success", () => {
  assert.equal(
    getSmsRuSendError({
      status: "OK",
      status_code: 100,
      sms: {
        "79001234567": {
          status: "ERROR",
          status_code: 207,
          status_text: "На этот номер нельзя отправлять сообщения",
        },
      },
    }),
    "На этот номер нельзя отправлять сообщения",
  );
});

test("fails when sms.ru omits per-message status", () => {
  assert.equal(
    getSmsRuSendError({ status: "OK", status_code: 100 }),
    "SMS-сервис не вернул статус сообщения",
  );
});
