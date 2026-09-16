import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth-options";
import { createNativeBridgeToken, nativeBridgeDeepLink } from "@/lib/native-auth-bridge";

export const runtime = "nodejs";

/** Authenticated Custom Tabs session → one-time deep link back into the APK. */
export async function POST() {
  const session = await getServerSession(authOptions);
  const userId = session?.user?.id;
  if (!userId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  try {
    const token = await createNativeBridgeToken(userId);
    const deepLink = nativeBridgeDeepLink(token);
    return NextResponse.json({ token, deepLink });
  } catch (error) {
    const message = error instanceof Error ? error.message : "bridge_failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
