import { createTransport } from "nodemailer";
import {
  BUG_REPORT_SUPPORT_EMAIL,
  formatBugReportSubject,
  formatBugReportText,
} from "@/lib/bug-report";
import { resolveEmailServer } from "@/lib/email-auth";

export type BugReportMailParams = {
  description: string;
  userId: string;
  userEmail: string | null;
  userName: string | null;
  pageUrl: string | null;
  userAgent: string | null;
  appVersion: string | null;
  screenshot?: {
    filename: string;
    contentType: string;
    content: Buffer;
  } | null;
};

export async function sendBugReportEmail(
  params: BugReportMailParams,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const server = resolveEmailServer();
  if (!server) {
    return { ok: false, error: "EMAIL_SERVER не настроен" };
  }

  const from = process.env.EMAIL_FROM?.trim() || "noreply@calorievision.ru";
  const to = BUG_REPORT_SUPPORT_EMAIL;
  const replyTo = params.userEmail?.trim() || undefined;
  const subject = formatBugReportSubject(params.userEmail || params.userId);
  const text = formatBugReportText({
    description: params.description,
    userId: params.userId,
    userEmail: params.userEmail,
    userName: params.userName,
    pageUrl: params.pageUrl,
    userAgent: params.userAgent,
    appVersion: params.appVersion,
    hasScreenshot: Boolean(params.screenshot),
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const transport = createTransport(server as any);

  try {
    await transport.sendMail({
      to,
      from,
      replyTo,
      subject,
      text,
      attachments: params.screenshot
        ? [
            {
              filename: params.screenshot.filename,
              contentType: params.screenshot.contentType,
              content: params.screenshot.content,
            },
          ]
        : undefined,
    });
    return { ok: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : "SMTP error";
    console.error("[bug-report] SMTP send failed:", message, error);
    return { ok: false, error: message };
  }
}
