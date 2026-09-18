import assert from "node:assert/strict";
import { test } from "node:test";
import { extractOAuthPhone, normalizeOAuthEmail } from "./oauth-account-link.ts";
import { yandexProfileToUser } from "./yandex-auth.ts";

test("extracts Yandex default_phone", () => {
  assert.equal(
    extractOAuthPhone({ default_phone: { id: 1, number: "+79001234567" } }),
    "+79001234567",
  );
  assert.equal(extractOAuthPhone({ default_phone: { id: 1, number: "89001234567" } }), "+79001234567");
});

test("extracts VK nested phone", () => {
  assert.equal(extractOAuthPhone({ user: { phone: "9001234567" } }), "+79001234567");
  assert.equal(extractOAuthPhone({ phone: "+7 (900) 123-45-67" }), "+79001234567");
});

test("normalizeOAuthEmail lowercases", () => {
  assert.equal(normalizeOAuthEmail("  User@Mail.RU "), "user@mail.ru");
  assert.equal(normalizeOAuthEmail(""), null);
  assert.equal(normalizeOAuthEmail(null), null);
});

test("yandexProfileToUser maps email, phone and avatar", () => {
  const user = yandexProfileToUser({
    id: "42",
    login: "ivan",
    client_id: "app",
    psuid: "psuid",
    display_name: "Иван",
    default_email: "Ivan@Yandex.ru",
    default_phone: { id: 1, number: "89001112233" },
    is_avatar_empty: false,
    default_avatar_id: "islands-200",
  });

  assert.equal(user.id, "42");
  assert.equal(user.name, "Иван");
  assert.equal(user.email, "ivan@yandex.ru");
  assert.equal(user.phone, "+79001112233");
  assert.equal(user.image, "https://avatars.yandex.net/get-yapic/islands-200/islands-200");
});

test("yandexProfileToUser skips empty avatar", () => {
  const user = yandexProfileToUser({
    id: "1",
    login: "x",
    client_id: "app",
    psuid: "psuid",
    is_avatar_empty: true,
    default_avatar_id: "islands-200",
  });
  assert.equal(user.image, null);
  assert.equal(user.phone, null);
});
