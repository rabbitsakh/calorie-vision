import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyNativeBridgeToken } from "@/lib/native-auth-bridge-server";
import { withBasePath } from "@/lib/paths";
import { setNextAuthSessionCookie } from "@/lib/telegram-oidc-session";
import { telegramOidcSiteOrigin } from "@/lib/telegram-oidc-route";

export const runtime = "nodejs";

/**
 * WebView opens this after Custom Tabs returns calorievision://native-bridge?token=…
 * Sets the NextAuth session cookie in the WebView jar and sends the user to /ration.
 *
 * Use public origin for redirects — request.url behind nginx is often localhost:3000.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const token = url.searchParams.get("token")?.trim() ?? "";
  const origin = telegramOidcSiteOrigin(request);
  const loginError = new URL(withBasePath("/login?error=OAuthCallback"), origin);

  if (!token) {
    return NextResponse.redirect(loginError);
  }

  const userId = await verifyNativeBridgeToken(token);
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
