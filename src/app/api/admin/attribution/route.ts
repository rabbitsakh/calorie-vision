import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth-session";
import { prisma } from "@/lib/prisma";
import { aggregateSignupAttribution } from "@/lib/signup-attribution-report";

export const dynamic = "force-dynamic";

/** Сводка регистраций по utm. Только чтение, только админ. */
export async function GET() {
  const { response } = await requireAdmin();
  if (response) return response;

  const users = await prisma.user.findMany({
    select: { createdAt: true, signupAttribution: true },
  });
  return NextResponse.json({
    rows: aggregateSignupAttribution(users, new Date()),
  });
}
