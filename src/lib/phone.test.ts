import assert from "node:assert/strict";
import { test } from "node:test";
import { formatPhoneDisplay, isValidPhone, normalizePhone } from "./phone.ts";

test("normalizes Russian phone numbers", () => {
  assert.equal(normalizePhone("+7 900 123-45-67"), "+79001234567");
  assert.equal(normalizePhone("8 (900) 123-45-67"), "+79001234567");
  assert.equal(normalizePhone("9001234567"), "+79001234567");
  assert.equal(normalizePhone("123"), null);
});

test("validates E.164 Russian numbers", () => {
  assert.equal(isValidPhone("+79001234567"), true);
  assert.equal(isValidPhone("79001234567"), false);
  assert.equal(isValidPhone("+7900123456"), false);
});

test("formats numbers for display", () => {
  assert.equal(formatPhoneDisplay("+79001234567"), "+7 (900) 123-45-67");
});
