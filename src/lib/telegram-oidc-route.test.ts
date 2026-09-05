import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { telegramOidcRedirectUri, telegramOidcSiteOrigin } from "./telegram-oidc-route.ts";

describe("telegramOidcSiteOrigin", () => {
  it("prefers public NEXTAUTH_URL over localhost request URL", () => {
    const prev = process.env.NEXTAUTH_URL;
    process.env.NEXTAUTH_URL = "https://calorievision.ru";
    try {
      const request = new Request("http://localhost:3000/api/auth/telegram/start", {
        headers: { host: "localhost:3000" },
      });
      assert.equal(telegramOidcSiteOrigin(request), "https://calorievision.ru");
    } finally {
      if (prev === undefined) {
        delete process.env.NEXTAUTH_URL;
      } else {
        process.env.NEXTAUTH_URL = prev;
      }
    }
  });

  it("uses x-forwarded-host when NEXTAUTH_URL is localhost", () => {
    const prev = process.env.NEXTAUTH_URL;
    const prevApp = process.env.NEXT_PUBLIC_APP_URL;
    process.env.NEXTAUTH_URL = "http://localhost:3000";
    delete process.env.NEXT_PUBLIC_APP_URL;
    try {
      const request = new Request("http://localhost:3000/api/auth/telegram/start", {
        headers: {
          host: "localhost:3000",
          "x-forwarded-host": "calorievision.ru",
          "x-forwarded-proto": "https",
        },
      });
      assert.equal(telegramOidcSiteOrigin(request), "https://calorievision.ru");
    } finally {
      if (prev === undefined) {
        delete process.env.NEXTAUTH_URL;
      } else {
        process.env.NEXTAUTH_URL = prev;
      }
      if (prevApp === undefined) {
        delete process.env.NEXT_PUBLIC_APP_URL;
      } else {
        process.env.NEXT_PUBLIC_APP_URL = prevApp;
      }
    }
  });

  it("builds callback redirect URI on the public origin", () => {
    assert.equal(
      telegramOidcRedirectUri("https://calorievision.ru"),
      "https://calorievision.ru/api/auth/telegram/callback",
    );
  });
});
