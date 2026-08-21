import assert from "node:assert/strict";
import { createHash, createHmac } from "node:crypto";
import { describe, it } from "node:test";
import {
  TELEGRAM_AUTH_MAX_AGE_SEC,
  telegramDisplayName,
  verifyTelegramAuth,
  type TelegramAuthPayload,
} from "./telegram-verify.ts";

const BOT_TOKEN = "123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11";

function signPayload(fields: Omit<TelegramAuthPayload, "hash">): TelegramAuthPayload {
  const data: Record<string, string> = {};
  for (const [key, value] of Object.entries(fields)) {
    if (value === undefined || value === null || value === "") continue;
    data[key] = String(value);
  }
  const checkString = Object.keys(data)
    .sort()
    .map((key) => `${key}=${data[key]}`)
    .join("\n");
  const secretKey = createHash("sha256").update(BOT_TOKEN).digest();
  const hash = createHmac("sha256", secretKey).update(checkString).digest("hex");
  return { ...fields, hash };
}

describe("verifyTelegramAuth", () => {
  it("accepts a valid fresh widget payload", () => {
    const now = 1_700_000_000;
    const payload = signPayload({
      id: 42,
      first_name: "Иван",
      username: "ivan",
      auth_date: now - 60,
    });

    assert.equal(verifyTelegramAuth(payload, BOT_TOKEN, TELEGRAM_AUTH_MAX_AGE_SEC, now), true);
  });

  it("rejects tampered fields", () => {
    const now = 1_700_000_000;
    const payload = signPayload({
      id: 42,
      first_name: "Иван",
      auth_date: now - 60,
    });
    payload.first_name = "Хакер";

    assert.equal(verifyTelegramAuth(payload, BOT_TOKEN, TELEGRAM_AUTH_MAX_AGE_SEC, now), false);
  });

  it("rejects expired auth_date", () => {
    const now = 1_700_000_000;
    const payload = signPayload({
      id: 42,
      first_name: "Иван",
      auth_date: now - TELEGRAM_AUTH_MAX_AGE_SEC - 10,
    });

    assert.equal(verifyTelegramAuth(payload, BOT_TOKEN, TELEGRAM_AUTH_MAX_AGE_SEC, now), false);
  });

  it("rejects missing hash", () => {
    assert.equal(
      verifyTelegramAuth(
        { id: 1, auth_date: 1_700_000_000, hash: "" },
        BOT_TOKEN,
        TELEGRAM_AUTH_MAX_AGE_SEC,
        1_700_000_000,
      ),
      false,
    );
  });
});

describe("telegramDisplayName", () => {
  it("prefers full name, then username", () => {
    assert.equal(telegramDisplayName({ id: 1, auth_date: 1, hash: "x", first_name: "А", last_name: "Б" }), "А Б");
    assert.equal(telegramDisplayName({ id: 1, auth_date: 1, hash: "x", username: "user" }), "user");
    assert.equal(telegramDisplayName({ id: 1, auth_date: 1, hash: "x" }), "Telegram");
  });
});
