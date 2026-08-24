import assert from "node:assert/strict";
import { test } from "node:test";
import {
  buildReferralShareUrl,
  referralCodeForUser,
  referralCodesMatch,
  telegramShareUrl,
  vkShareUrl,
} from "./referral.ts";

test("referral code is stable for the same user id", () => {
  process.env.NEXTAUTH_SECRET = "test-secret";
  const a = referralCodeForUser("cluser123");
  const b = referralCodeForUser("cluser123");
  assert.equal(a, b);
  assert.equal(a.length, 12);
  assert.notEqual(a, referralCodeForUser("other-user"));
});

test("referralCodesMatch accepts the derived code", () => {
  process.env.NEXTAUTH_SECRET = "test-secret";
  const code = referralCodeForUser("user-a");
  assert.equal(referralCodesMatch("user-a", code), true);
  assert.equal(referralCodesMatch("user-a", "nope"), false);
  assert.equal(referralCodesMatch("other", code), false);
});

test("share urls include the referral link", () => {
  const url = buildReferralShareUrl("AbCdEfGhIjKl", "https://calorievision.ru");
  assert.equal(url, "https://calorievision.ru/?ref=AbCdEfGhIjKl");
  assert.match(telegramShareUrl(url, "hi"), /^https:\/\/t\.me\/share\/url\?/);
  assert.match(vkShareUrl(url), /^https:\/\/vk\.com\/share\.php\?/);
});
