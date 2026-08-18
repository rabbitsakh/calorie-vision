import { NextRequest } from "next/server";
import NextAuth from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { applyVkCallbackToSearchParams } from "@/lib/vk-auth";

export const dynamic = "force-dynamic";

const handler = NextAuth(authOptions);

type RouteContext = { params: Promise<{ nextauth: string[] }> };

function prepareAuthRequest(req: NextRequest, segments: string[]): NextRequest {
  if (segments[0] !== "callback" || segments[1] !== "vk") {
    return req;
  }

  const url = req.nextUrl.clone();
  url.search = applyVkCallbackToSearchParams(url.searchParams).toString();
  return new NextRequest(url, req);
}

async function handle(req: NextRequest, context: RouteContext) {
  const segments = (await context.params).nextauth ?? [];
  return handler(prepareAuthRequest(req, segments), context);
}

export { handle as GET, handle as POST };
