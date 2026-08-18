import assert from "node:assert/strict";
import { test } from "node:test";
import { sanitizeAdapterAccount, sanitizeAdapterUser } from "./auth-account.ts";

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

test("turns a blank OAuth email into null so unique email does not collide", () => {
  const user = sanitizeAdapterUser({
    id: "vk-id",
    name: " Иван ",
    email: "  ",
    image: "https://example.com/a.png",
    phone: "+79991234567",
  });

  assert.deepEqual(user, {
    name: "Иван",
    email: null,
    image: "https://example.com/a.png",
    emailVerified: null,
  });
});
