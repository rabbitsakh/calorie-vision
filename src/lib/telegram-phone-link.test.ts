import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { normalizeTelegramPhone } from "./telegram-phone-link.ts";

describe("normalizeTelegramPhone", () => {
  it("normalizes +7, 8… and bare 10-digit RU numbers", () => {
    assert.equal(normalizeTelegramPhone("+79001234567"), "+79001234567");
    assert.equal(normalizeTelegramPhone("79001234567"), "+79001234567");
    assert.equal(normalizeTelegramPhone("89001234567"), "+79001234567");
    assert.equal(normalizeTelegramPhone("9001234567"), "+79001234567");
  });

  it("accepts spaced / formatted input", () => {
    assert.equal(normalizeTelegramPhone("+7 (900) 123-45-67"), "+79001234567");
  });

  it("rejects empty and non-RU numbers", () => {
    assert.equal(normalizeTelegramPhone(""), null);
    assert.equal(normalizeTelegramPhone(null), null);
    assert.equal(normalizeTelegramPhone("971577777777"), null);
  });
});
