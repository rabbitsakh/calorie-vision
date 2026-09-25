import assert from "node:assert/strict";
import { test } from "node:test";
import { telegramOidcSiteOrigin } from "./telegram-oidc-route.ts";

/**
 * Regression: APK opened /api/auth/capacitor-resume and followed Location to
 * https://localhost:3000/… (internal Next host behind nginx) → WebView errorPath.
 */
test("capacitor resume origin must be public even when request URL is localhost", () => {
  const prev = process.env.NEXTAUTH_URL;
  const prevApp = process.env.NEXT_PUBLIC_APP_URL;
  process.env.NEXTAUTH_URL = "https://calorievision.ru";
  delete process.env.NEXT_PUBLIC_APP_URL;
  try {
    const request = new Request(
      "http://localhost:3000/api/auth/capacitor-resume?token=abc",
      { headers: { host: "localhost:3000" } },
    );
    const origin = telegramOidcSiteOrigin(request);
    assert.equal(origin, "https://calorievision.ru");
    const login = new URL("/login?error=SessionRequired", origin);
    assert.equal(login.href, "https://calorievision.ru/login?error=SessionRequired");
    assert.doesNotMatch(login.href, /localhost/);
  } finally {
    if (prev === undefined) delete process.env.NEXTAUTH_URL;
    else process.env.NEXTAUTH_URL = prev;
    if (prevApp === undefined) delete process.env.NEXT_PUBLIC_APP_URL;
    else process.env.NEXT_PUBLIC_APP_URL = prevApp;
  }
});

test("native-bridge consume origin uses x-forwarded-host when NEXTAUTH is localhost", () => {
  const prev = process.env.NEXTAUTH_URL;
  const prevApp = process.env.NEXT_PUBLIC_APP_URL;
  process.env.NEXTAUTH_URL = "http://localhost:3000";
  delete process.env.NEXT_PUBLIC_APP_URL;
  try {
    const request = new Request("http://localhost:3000/api/auth/native-bridge/consume?token=abc", {
      headers: {
        host: "localhost:3000",
        "x-forwarded-host": "calorievision.ru",
        "x-forwarded-proto": "https",
      },
    });
    assert.equal(telegramOidcSiteOrigin(request), "https://calorievision.ru");
  } finally {
    if (prev === undefined) delete process.env.NEXTAUTH_URL;
    else process.env.NEXTAUTH_URL = prev;
    if (prevApp === undefined) delete process.env.NEXT_PUBLIC_APP_URL;
    else process.env.NEXT_PUBLIC_APP_URL = prevApp;
  }
});
