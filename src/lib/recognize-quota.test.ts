import assert from "node:assert/strict";
import { test } from "node:test";
import { resetRateLimitsForTests } from "@/lib/rate-limit";
import { PHOTO_SCALE_TIP } from "@/lib/photo-scale-tip";
import {
  DEFAULT_DAILY_FREE_PHOTOS,
  checkDailyRecognizeQuota,
  dailyQuotaKey,
  freeDailyPhotoLimit,
  isProRecognizeUser,
} from "@/lib/recognize-quota";

test("freeDailyPhotoLimit defaults and clamps", () => {
  const prev = process.env.CV_RECOGNIZE_DAILY_FREE;
  try {
    delete process.env.CV_RECOGNIZE_DAILY_FREE;
    assert.equal(freeDailyPhotoLimit(), DEFAULT_DAILY_FREE_PHOTOS);
    process.env.CV_RECOGNIZE_DAILY_FREE = "5";
    assert.equal(freeDailyPhotoLimit(), 5);
    process.env.CV_RECOGNIZE_DAILY_FREE = "0";
    assert.equal(freeDailyPhotoLimit(), DEFAULT_DAILY_FREE_PHOTOS);
  } finally {
    if (prev === undefined) delete process.env.CV_RECOGNIZE_DAILY_FREE;
    else process.env.CV_RECOGNIZE_DAILY_FREE = prev;
  }
});

test("isProRecognizeUser matches env lists", () => {
  const prevIds = process.env.CV_PRO_USER_IDS;
  const prevEmails = process.env.CV_PRO_EMAILS;
  try {
    process.env.CV_PRO_USER_IDS = "abc, Def ";
    process.env.CV_PRO_EMAILS = "Pro@Example.com";
    assert.equal(isProRecognizeUser({ userId: "ABC" }), true);
    assert.equal(isProRecognizeUser({ userId: "nope", email: "pro@example.com" }), true);
    assert.equal(isProRecognizeUser({ userId: "nope", email: "other@x.com" }), false);
  } finally {
    if (prevIds === undefined) delete process.env.CV_PRO_USER_IDS;
    else process.env.CV_PRO_USER_IDS = prevIds;
    if (prevEmails === undefined) delete process.env.CV_PRO_EMAILS;
    else process.env.CV_PRO_EMAILS = prevEmails;
  }
});

test("checkDailyRecognizeQuota blocks after free limit", async () => {
  resetRateLimitsForTests();
  const prev = process.env.CV_RECOGNIZE_DAILY_FREE;
  const prevIds = process.env.CV_PRO_USER_IDS;
  delete process.env.CV_PRO_USER_IDS;
  process.env.CV_RECOGNIZE_DAILY_FREE = "2";
  try {
    const user = `u-quota-${Date.now()}`;
    const now = Date.now();
    assert.equal(dailyQuotaKey(user, now).includes(user), true);
    assert.equal((await checkDailyRecognizeQuota({ userId: user, nowMs: now })).allowed, true);
    assert.equal((await checkDailyRecognizeQuota({ userId: user, nowMs: now })).allowed, true);
    const blocked = await checkDailyRecognizeQuota({ userId: user, nowMs: now });
    assert.equal(blocked.allowed, false);
    assert.equal(blocked.code, "DAILY_PHOTO_LIMIT");
  } finally {
    if (prev === undefined) delete process.env.CV_RECOGNIZE_DAILY_FREE;
    else process.env.CV_RECOGNIZE_DAILY_FREE = prev;
    if (prevIds === undefined) delete process.env.CV_PRO_USER_IDS;
    else process.env.CV_PRO_USER_IDS = prevIds;
    resetRateLimitsForTests();
  }
});

test("checkDailyRecognizeQuota skips limit for Pro", async () => {
  resetRateLimitsForTests();
  const prev = process.env.CV_RECOGNIZE_DAILY_FREE;
  const prevIds = process.env.CV_PRO_USER_IDS;
  process.env.CV_RECOGNIZE_DAILY_FREE = "1";
  process.env.CV_PRO_USER_IDS = "pro-user";
  try {
    const now = Date.now();
    assert.equal(
      (await checkDailyRecognizeQuota({ userId: "pro-user", nowMs: now })).allowed,
      true,
    );
    assert.equal(
      (await checkDailyRecognizeQuota({ userId: "pro-user", nowMs: now })).allowed,
      true,
    );
    assert.equal(
      (await checkDailyRecognizeQuota({ userId: "pro-user", nowMs: now })).isPro,
      true,
    );
  } finally {
    if (prev === undefined) delete process.env.CV_RECOGNIZE_DAILY_FREE;
    else process.env.CV_RECOGNIZE_DAILY_FREE = prev;
    if (prevIds === undefined) delete process.env.CV_PRO_USER_IDS;
    else process.env.CV_PRO_USER_IDS = prevIds;
    resetRateLimitsForTests();
  }
});

test("PHOTO_SCALE_TIP mentions fork", () => {
  assert.match(PHOTO_SCALE_TIP, /вилк/i);
});
