import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth-session";
import { sendBugReportEmail } from "@/lib/bug-report-mail";
import { validateBugReport } from "@/lib/bug-report";
import { prisma } from "@/lib/prisma";
import { checkRateLimitAsync } from "@/lib/rate-limit";
import { readPackageVersion } from "@/lib/read-package-version";

export const dynamic = "force-dynamic";

const RATE_LIMIT = 5;
const RATE_WINDOW_MS = 60 * 60 * 1000;

export async function POST(request: Request) {
  try {
    const { session, response } = await requireSession();
    if (response) return response;

    const userId = session.user.id;
    const rate = await checkRateLimitAsync(`bug-report:${userId}`, RATE_LIMIT, RATE_WINDOW_MS);
    if (!rate.allowed) {
      return NextResponse.json(
        {
          error: `Слишком много сообщений. Подождите ${rate.retryAfterSec} сек.`,
          retryAfterSec: rate.retryAfterSec,
        },
        { status: 429 },
      );
    }

    const form = await request.formData();
    const description = String(form.get("description") ?? "");
    const pageUrl = String(form.get("pageUrl") ?? "");
    const userAgent = String(form.get("userAgent") ?? "");
    const appVersionField = String(form.get("appVersion") ?? "");
    const file = form.get("screenshot");

    let screenshotMeta: { mime: string; size: number; filename: string } | null = null;
    let screenshotPayload: { filename: string; contentType: string; content: Buffer } | null =
      null;

    if (file && typeof file !== "string" && "arrayBuffer" in file) {
      const blob = file as File;
      const buf = Buffer.from(await blob.arrayBuffer());
      const mime = (blob.type || "application/octet-stream").toLowerCase();
      const filename = (blob.name || "screenshot.jpg").replace(/[^\w.\-()+ ]+/g, "_").slice(0, 80);
      screenshotMeta = { mime, size: buf.length, filename };
      screenshotPayload = { filename, contentType: mime, content: buf };
    }

    const validated = validateBugReport({
      description,
      pageUrl,
      userAgent,
      appVersion: appVersionField || readPackageVersion(),
      screenshot: screenshotMeta,
    });
    if (!validated.ok) {
      return NextResponse.json({ error: validated.error }, { status: 400 });
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { email: true, name: true },
    });

    const sent = await sendBugReportEmail({
      description: validated.description,
      userId,
      userEmail: user?.email ?? session.user.email ?? null,
      userName: user?.name ?? session.user.name ?? null,
      pageUrl: validated.pageUrl,
      userAgent: validated.userAgent,
      appVersion: validated.appVersion,
      screenshot: screenshotPayload,
    });

    if (!sent.ok) {
      return NextResponse.json(
        { error: "Не удалось отправить письмо. Напишите на support@calorievision.ru" },
        { status: 502 },
      );
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Не удалось отправить сообщение" }, { status: 500 });
  }
}
