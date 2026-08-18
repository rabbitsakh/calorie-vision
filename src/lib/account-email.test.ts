import assert from "node:assert/strict";
import { test } from "node:test";
import { lockedEmailDecision, normalizeAccountEmail } from "./account-email.ts";

test("normalizes account email", () => {
  assert.equal(normalizeAccountEmail("  User@Mail.RU "), "user@mail.ru");
  assert.equal(normalizeAccountEmail("  "), null);
  assert.equal(normalizeAccountEmail(null), null);
  assert.equal(normalizeAccountEmail(undefined), null);
});

test("saving a locked profile with the same email is a no-op", () => {
  assert.deepEqual(
    lockedEmailDecision(true, "User@Mail.RU", "user@mail.ru"),
    { action: "skip" },
  );
  assert.deepEqual(lockedEmailDecision(true, undefined, "user@mail.ru"), { action: "skip" });
});

test("rejects changing a Google/VK email", () => {
  assert.deepEqual(
    lockedEmailDecision(true, "other@mail.ru", "user@mail.ru"),
    { action: "reject" },
  );
  assert.deepEqual(lockedEmailDecision(true, null, "user@mail.ru"), { action: "reject" });
});

test("allows email updates when login is not Google/VK", () => {
  assert.deepEqual(
    lockedEmailDecision(false, " New@Mail.ru ", "old@mail.ru"),
    { action: "update", email: "new@mail.ru" },
  );
});
