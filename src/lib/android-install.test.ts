import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import {
  DEFAULT_APK_PATH,
  DEFAULT_RUSTORE_URL,
  RUSTORE_PACKAGE_ID,
  getApkDownloadUrl,
  getRustoreBadgeUrl,
  getRustoreUrl,
} from "./android-install.ts";

const PREV_APK = process.env.NEXT_PUBLIC_APK_URL;
const PREV_RUSTORE = process.env.NEXT_PUBLIC_RUSTORE_URL;
const PREV_BASE = process.env.NEXT_PUBLIC_BASE_PATH;

afterEach(() => {
  if (PREV_APK === undefined) delete process.env.NEXT_PUBLIC_APK_URL;
  else process.env.NEXT_PUBLIC_APK_URL = PREV_APK;
  if (PREV_RUSTORE === undefined) delete process.env.NEXT_PUBLIC_RUSTORE_URL;
  else process.env.NEXT_PUBLIC_RUSTORE_URL = PREV_RUSTORE;
  if (PREV_BASE === undefined) delete process.env.NEXT_PUBLIC_BASE_PATH;
  else process.env.NEXT_PUBLIC_BASE_PATH = PREV_BASE;
});

test("getApkDownloadUrl defaults to public downloads path", () => {
  delete process.env.NEXT_PUBLIC_APK_URL;
  delete process.env.NEXT_PUBLIC_BASE_PATH;
  assert.equal(getApkDownloadUrl(), DEFAULT_APK_PATH);
});

test("getApkDownloadUrl respects absolute CDN override", () => {
  process.env.NEXT_PUBLIC_APK_URL = "https://cdn.example/app.apk";
  assert.equal(getApkDownloadUrl(), "https://cdn.example/app.apk");
});

test("getRustoreUrl defaults to published catalog card", () => {
  delete process.env.NEXT_PUBLIC_RUSTORE_URL;
  assert.equal(getRustoreUrl(), DEFAULT_RUSTORE_URL);
});

test("getRustoreUrl returns trimmed URL override", () => {
  process.env.NEXT_PUBLIC_RUSTORE_URL = " https://www.rustore.ru/catalog/app/x ";
  assert.equal(getRustoreUrl(), "https://www.rustore.ru/catalog/app/x");
});

test("getRustoreUrl empty env hides the button", () => {
  process.env.NEXT_PUBLIC_RUSTORE_URL = " ";
  assert.equal(getRustoreUrl(), null);
});

test("getRustoreBadgeUrl adds RuStore UTM marks", () => {
  delete process.env.NEXT_PUBLIC_RUSTORE_URL;
  const url = getRustoreBadgeUrl();
  assert.ok(url);
  const parsed = new URL(url!);
  assert.equal(parsed.origin + parsed.pathname, DEFAULT_RUSTORE_URL);
  assert.equal(parsed.searchParams.get("utm_source"), "available_in_rustore");
  assert.equal(parsed.searchParams.get("utm_medium"), RUSTORE_PACKAGE_ID);
  assert.equal(parsed.searchParams.get("rsm"), "1");
  assert.equal(parsed.searchParams.get("mt_link_id"), "iios36");
  assert.equal(parsed.searchParams.get("mt_sub1"), RUSTORE_PACKAGE_ID);
});

test("getRustoreBadgeUrl is null when RuStore is hidden", () => {
  process.env.NEXT_PUBLIC_RUSTORE_URL = " ";
  assert.equal(getRustoreBadgeUrl(), null);
});
