import assert from "node:assert/strict";
import { test } from "node:test";
import { isBlankAuthEmail, oauthUserCreateId, sanitizeAdapterAccount, sanitizeAdapterUser } from "./auth-account.ts";

test("drops VK token fields that Prisma Account cannot store", () => {
  const account = sanitizeAdapterAccount({
    userId: "user-1",
    type: "oauth",
    provider: "vk",
    providerAccountId: "123",
    access_token: "tok",
    refresh_token: "ref",
    id_token: "idtok",
    expires_in: 3600,
    user_id: 123,
    state: "vk-state",
    scope: "email phone",
  });

  assert.equal(account.userId, "user-1");
  assert.equal(account.providerAccountId, "123");
  assert.equal(account.access_token, "tok");
  assert.equal(account.scope, "email phone");
  assert.equal(account.user_id, undefined);
  assert.equal(account.state, undefined);
  assert.equal(account.expires_in, undefined);
  assert.equal(typeof account.expires_at, "number");
});

test("stringifies numeric OAuth account ids", () => {
  const account = sanitizeAdapterAccount({
    userId: 99,
    type: "oauth",
    provider: "vk",
    providerAccountId: 123456,
  });
  assert.equal(account.userId, "99");
  assert.equal(account.providerAccountId, "123456");
});

test("skips blank emails so getUserByEmail does not match every NULL row", () => {
  assert.equal(isBlankAuthEmail(null), true);
  assert.equal(isBlankAuthEmail(""), true);
  assert.equal(isBlankAuthEmail("  "), true);
  assert.equal(isBlankAuthEmail("user@mail.ru"), false);
});

test("keeps the OAuth profile id so the same VK user is not created twice", () => {
  assert.equal(oauthUserCreateId({ id: "123456" }), "123456");
  assert.equal(oauthUserCreateId({ id: "  " }), undefined);
  assert.equal(oauthUserCreateId({}), undefined);
});

test("keeps a verified OAuth phone so accounts can link by phone", () => {
  const user = sanitizeAdapterUser({
    id: "vk-id",
    name: " Иван ",
    email: "  ",
    image: "https://example.com/a.png",
    phone: "+79991234567",
  });

  assert.equal(user.name, "Иван");
  assert.equal(user.email, null);
  assert.equal(user.image, "https://example.com/a.png");
  assert.equal(user.emailVerified, null);
  assert.equal(user.phone, "+79991234567");
  assert.ok(user.phoneVerified instanceof Date);
});

test("normalizes OAuth phone digits without plus", () => {
  const user = sanitizeAdapterUser({
    email: "a@b.ru",
    phone: "89991234567",
  });
  assert.equal(user.phone, "+79991234567");
});
