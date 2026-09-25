import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth-options";
import {
  createCapacitorResumeToken,
  verifyCapacitorResumeToken,
} from "@/lib/native-auth-bridge-server";
import { withBasePath } from "@/lib/paths";
import { prisma } from "@/lib/prisma";
import { setNextAuthSessionCookie } from "@/lib/telegram-oidc-session";
import { telegramOidcSiteOrigin } from "@/lib/telegram-oidc-route";

export const runtime = "nodejs";

/**
 * POST — authenticated WebView issues a long-lived resume token for Preferences.
 * GET  — local shell / AuthGate opens with ?token=… → set session cookie → /ration.
 *
 * Redirects must use the public site origin (NEXTAUTH_URL / x-forwarded-host),
 * never the internal `localhost:3000` request URL behind nginx — that broke the
 * APK (WebView followed Location to device localhost → errorPath «Нет интернета»).
 */
export async function POST() {
  const session = await getServerSession(authOptions);
  const userId = session?.user?.id;
  if (!userId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  try {
    const token = await createCapacitorResumeToken(userId);
    return NextResponse.json({ token });
  } catch (error) {
    const message = error instanceof Error ? error.message : "resume_issue_failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const token = url.searchParams.get("token")?.trim() ?? "";
  const origin = telegramOidcSiteOrigin(request);
  const loginError = new URL(withBasePath("/login?error=SessionRequired"), origin);

  if (!token) {
    return NextResponse.redirect(loginError);
  }

  const userId = await verifyCapacitorResumeToken(token);
  if (!userId) {
    return NextResponse.redirect(loginError);
  }

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) {
    return NextResponse.redirect(loginError);
  }

  const ration = new URL(withBasePath("/ration/"), origin);
  const response = NextResponse.redirect(ration);
  await setNextAuthSessionCookie(response, {
    id: user.id,
    name: user.name,
    email: user.email,
    image: user.image,
  });
  return response;
}
