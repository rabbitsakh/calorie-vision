import assert from "node:assert/strict";
import test from "node:test";

/**
 * Mirror of URL check in capacitor-oauth.ts (kept local so the test
 * does not import next-auth client code).
 */
function isExternalOAuthUrl(url: string): boolean {
  try {
    const host = new URL(url).hostname;
    return (
      host === "accounts.google.com" ||
      host.endsWith(".google.com") ||
      host === "id.vk.com" ||
      host.endsWith(".vk.com") ||
      host.includes("oauth")
    );
  } catch {
    return false;
  }
}

test("detects Google authorize URL as external OAuth", () => {
  assert.equal(
    isExternalOAuthUrl(
      "https://accounts.google.com/o/oauth2/v2/auth?client_id=x&redirect_uri=https://calorievision.ru/api/auth/callback/google",
    ),
    true,
  );
});

test("detects VK as external OAuth", () => {
  assert.equal(isExternalOAuthUrl("https://id.vk.com/authorize?client_id=1"), true);
});

test("same-origin finish URL is not external OAuth", () => {
  assert.equal(isExternalOAuthUrl("https://calorievision.ru/ration/"), false);
  assert.equal(isExternalOAuthUrl("/ration/"), false);
});
