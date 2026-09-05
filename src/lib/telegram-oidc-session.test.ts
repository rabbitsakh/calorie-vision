import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { decode } from "next-auth/jwt";
import { NextResponse } from "next/server";
import { nextAuthSessionCookieName, setNextAuthSessionCookie } from "./telegram-oidc-session.ts";

describe("telegram OIDC session cookie", () => {
  it("writes a NextAuth JWT the session callback can read", async () => {
    process.env.NEXTAUTH_SECRET = "test-secret-for-oidc-session";
    process.env.NEXTAUTH_URL = "https://calorievision.ru";

    const response = NextResponse.redirect("https://calorievision.ru/ration/");
    await setNextAuthSessionCookie(response, {
      id: "user-123",
      name: "Test User",
      email: null,
      image: null,
    });

    const cookieName = nextAuthSessionCookieName();
    assert.equal(cookieName, "__Secure-next-auth.session-token");
    const raw = response.cookies.get(cookieName)?.value;
    assert.ok(raw);

    const token = await decode({
      token: raw,
      secret: process.env.NEXTAUTH_SECRET!,
    });
    assert.ok(token);
    assert.equal(token.sub, "user-123");
    assert.equal(token.id, "user-123");
    assert.equal(token.name, "Test User");
  });
});
