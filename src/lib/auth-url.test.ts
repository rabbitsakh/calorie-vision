import assert from "node:assert/strict";
import { test } from "node:test";
import { getCanonicalSiteUrl, publicBrowserOrigin, resolveAuthRedirect } from "./auth-url.ts";

test("strips /api/auth from production NEXTAUTH_URL", () => {
  assert.equal(
    getCanonicalSiteUrl("https://calorievision.ru/api/auth", ""),
    "https://calorievision.ru",
  );
});

test("keeps custom base path when NEXTAUTH_URL includes the auth route", () => {
  assert.equal(
    getCanonicalSiteUrl("http://localhost:3000/calorie-vision/api/auth", "/calorie-vision"),
    "http://localhost:3000/calorie-vision",
  );
});

test("uses the site origin when NEXTAUTH_URL is already canonical", () => {
  assert.equal(
    getCanonicalSiteUrl("https://calorievision.ru", ""),
    "https://calorievision.ru",
  );
});

test("appends NEXT_PUBLIC_BASE_PATH when NEXTAUTH_URL is only the origin", () => {
  assert.equal(
    getCanonicalSiteUrl("http://localhost:3000", "/calorie-vision"),
    "http://localhost:3000/calorie-vision",
  );
});

test("production ignores localhost NEXTAUTH_URL", () => {
  const prev = process.env.NODE_ENV;
  process.env.NODE_ENV = "production";
  try {
    assert.equal(
      getCanonicalSiteUrl("http://localhost:3000", ""),
      "https://calorievision.ru",
    );
    assert.equal(getCanonicalSiteUrl("", ""), "https://calorievision.ru");
  } finally {
    process.env.NODE_ENV = prev;
  }
});

test("redirects relative callback URLs to the site root, not /api/auth", () => {
  assert.equal(
    resolveAuthRedirect("/", "https://calorievision.ru"),
    "https://calorievision.ru/",
  );
});

test("allows same-origin absolute callback URLs", () => {
  assert.equal(
    resolveAuthRedirect("https://calorievision.ru/login", "https://calorievision.ru"),
    "https://calorievision.ru/login",
  );
});

test("allows calorievision absolute URLs even if siteUrl is mis-set to localhost", () => {
  assert.equal(
    resolveAuthRedirect("https://calorievision.ru/auth/native-bridge", "http://localhost:3000"),
    "https://calorievision.ru/auth/native-bridge",
  );
});

test("rejects external callback URLs", () => {
  assert.equal(
    resolveAuthRedirect("https://evil.example/", "https://calorievision.ru"),
    "https://calorievision.ru/",
  );
});

test("publicBrowserOrigin rewrites localhost", () => {
  assert.equal(publicBrowserOrigin("http://localhost:3000"), "https://calorievision.ru");
  assert.equal(publicBrowserOrigin("https://calorievision.ru"), "https://calorievision.ru");
});
