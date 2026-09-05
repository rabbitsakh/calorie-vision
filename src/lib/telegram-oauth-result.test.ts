import assert from "node:assert/strict";
import { test } from "node:test";
import { parseTelegramLoginCallback, parseTgAuthResult } from "./telegram-oauth-result.ts";

test("parseTgAuthResult decodes base64url JSON from oauth.telegram.org", () => {
  const payload = {
    id: 123456,
    first_name: "Иван",
    username: "ivan",
    auth_date: 1700000000,
    hash: "abcdef",
  };
  const encoded = Buffer.from(JSON.stringify(payload), "utf8")
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");

  const parsed = parseTgAuthResult(encoded);
  assert.equal(parsed?.id, "123456");
  assert.equal(parsed?.first_name, "Иван");
  assert.equal(parsed?.username, "ivan");
  assert.equal(parsed?.auth_date, "1700000000");
  assert.equal(parsed?.hash, "abcdef");
});

test("parseTelegramLoginCallback prefers tgAuthResult hash fragment", () => {
  const payload = {
    id: 42,
    first_name: "Ann",
    auth_date: 1700000001,
    hash: "deadbeef",
  };
  const encoded = Buffer.from(JSON.stringify(payload), "utf8").toString("base64");

  const parsed = parseTelegramLoginCallback(`#tgAuthResult=${encoded}`, {
    id: "wrong",
  });

  assert.equal(parsed.id, "42");
  assert.equal(parsed.first_name, "Ann");
  assert.equal(parsed.auth_date, "1700000001");
  assert.equal(parsed.hash, "deadbeef");
});

test("parseTelegramLoginCallback falls back to query params", () => {
  const parsed = parseTelegramLoginCallback("", {
    id: "7",
    auth_date: "1",
    hash: "abc",
    first_name: "Bob",
  });
  assert.equal(parsed.id, "7");
  assert.equal(parsed.first_name, "Bob");
  assert.equal(parsed.hash, "abc");
});
