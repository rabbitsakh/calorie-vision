import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth-options";
import { getCanonicalSiteUrl } from "@/lib/auth-url";
import {
  nativeBridgeConsumeUrl,
  nativeBridgeDeepLink,
  nativeBridgeIntentUrl,
} from "@/lib/native-auth-bridge";
import { createNativeBridgeToken } from "@/lib/native-auth-bridge-server";
import { telegramOidcSiteOrigin } from "@/lib/telegram-oidc-route";

export const runtime = "nodejs";

/** Authenticated Custom Tabs session → one-time deep link back into the APK. */
export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  const userId = session?.user?.id;
  if (!userId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  try {
    const token = await createNativeBridgeToken(userId);
    const site = getCanonicalSiteUrl() || telegramOidcSiteOrigin(request);
    const origin = telegramOidcSiteOrigin(request) || site;
    return NextResponse.json({
      token,
      deepLink: nativeBridgeDeepLink(token),
      intentUrl: nativeBridgeIntentUrl(token, site),
      consumeUrl: nativeBridgeConsumeUrl(origin, token),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "bridge_failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
