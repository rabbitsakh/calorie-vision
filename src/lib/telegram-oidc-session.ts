import { encode } from "next-auth/jwt";
import type { NextResponse } from "next/server";

const SESSION_MAX_AGE_SEC = 30 * 24 * 60 * 60;

function prefersSecureAuthCookies(): boolean {
  const url = process.env.NEXTAUTH_URL?.trim() || process.env.NEXT_PUBLIC_APP_URL?.trim() || "";
  return url.startsWith("https://");
}

export function nextAuthSessionCookieName(): string {
  return prefersSecureAuthCookies() ? "__Secure-next-auth.session-token" : "next-auth.session-token";
}

/** Create a NextAuth JWT session cookie so OIDC can finish without a client-side ticket. */
export async function setNextAuthSessionCookie(
  response: NextResponse,
  user: { id: string; name?: string | null; email?: string | null; image?: string | null },
): Promise<void> {
  const secret = process.env.NEXTAUTH_SECRET?.trim() || process.env.AUTH_SECRET?.trim();
  if (!secret) {
    throw new Error("NEXTAUTH_SECRET is required for Telegram OIDC session");
  }

  const secure = prefersSecureAuthCookies();
  const token = await encode({
    token: {
      sub: user.id,
      id: user.id,
      name: user.name,
      email: user.email,
      picture: user.image,
    },
    secret,
    maxAge: SESSION_MAX_AGE_SEC,
  });

  response.cookies.set(nextAuthSessionCookieName(), token, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    secure,
    maxAge: SESSION_MAX_AGE_SEC,
  });
}
