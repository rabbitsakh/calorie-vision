import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isEmailLoginConfigured } from "@/lib/email-auth";
import {
  digestEndDateForTimezone,
  loadWeeklyDigestSummary,
  sendWeeklyDigestEmail,
} from "@/lib/weekly-digest";

export const dynamic = "force-dynamic";

function authorizeCron(request: NextRequest): boolean {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) return false;
  const auth = request.headers.get("authorization");
  return auth === `Bearer ${secret}`;
}

/**
 * Weekly email digest for users with weeklyDigestEmail=true and a valid email.
 * Skips entirely when SMTP (EMAIL_SERVER) is not configured.
 *
 * Auth: Authorization: Bearer $CRON_SECRET
 * Suggested cron: 0 7 * * 1 (Monday 07:00 UTC)
 * dryRun=1 — count recipients without sending.
 */
export async function GET(request: NextRequest) {
  if (!authorizeCron(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!isEmailLoginConfigured()) {
    return NextResponse.json({
      ok: true,
      skipped: true,
      reason: "EMAIL_SERVER не настроен — рассылка пропущена",
      sent: 0,
    });
  }

  const dryRun = request.nextUrl.searchParams.get("dryRun") === "1";
  const limitRaw = Number(request.nextUrl.searchParams.get("limit") ?? "200");
  const limit = Number.isFinite(limitRaw) ? Math.min(Math.max(1, Math.floor(limitRaw)), 500) : 200;

  const users = await prisma.user.findMany({
    where: {
      weeklyDigestEmail: true,
      email: { not: null },
    },
    select: { id: true, email: true, name: true, timezone: true },
    take: limit,
  });

  const recipients = users.filter((u) => Boolean(u.email?.includes("@")));

  if (dryRun) {
    return NextResponse.json({
      ok: true,
      dryRun: true,
      candidates: recipients.length,
      sent: 0,
    });
  }

  let sent = 0;
  let failed = 0;
  const errors: string[] = [];

  for (const user of recipients) {
    const email = user.email!;
    try {
      const end = digestEndDateForTimezone(user.timezone);
      const summary = await loadWeeklyDigestSummary(user.id, end);
      // Skip empty weeks to keep volume safe
      if (summary.daysLogged === 0 && summary.avgWaterMl === 0) {
        continue;
      }
      const result = await sendWeeklyDigestEmail({
        to: email,
        summary,
        name: user.name,
      });
      if (result.ok) {
        sent += 1;
      } else {
        failed += 1;
        if (errors.length < 5) errors.push(`${email}: ${result.error}`);
      }
    } catch (error) {
      failed += 1;
      const message = error instanceof Error ? error.message : "error";
      if (errors.length < 5) errors.push(`${email}: ${message}`);
    }
  }

  return NextResponse.json({
    ok: true,
    candidates: recipients.length,
    sent,
    failed,
    errors: errors.length ? errors : undefined,
  });
}

export const POST = GET;
