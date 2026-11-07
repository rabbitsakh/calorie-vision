import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/auth-session";
import { prisma } from "@/lib/prisma";
import { parseSignupAttributionBody } from "@/lib/signup-attribution";

export const dynamic = "force-dynamic";

/** Первые рекламные метки аккаунта. Повторный заход источник не меняет. */
export async function POST(request: NextRequest) {
  const { session, response } = await requireSession();
  if (response) return response;

  const body = parseSignupAttributionBody(await request.json().catch(() => null));
  if (!body) {
    return NextResponse.json({ error: "Нет utm-меток" }, { status: 400 });
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { id: true, signupAttribution: true },
  });
  if (!user) {
    return NextResponse.json({ error: "Пользователь не найден" }, { status: 404 });
  }
  if (user.signupAttribution) {
    return NextResponse.json({ ok: true, already: true });
  }

  await prisma.user.update({
    where: { id: user.id },
    data: { signupAttribution: body },
  });
  return NextResponse.json({ ok: true, already: false });
}
