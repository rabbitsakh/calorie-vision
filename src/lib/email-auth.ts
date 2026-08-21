import { createTransport } from "nodemailer";

export type SendMagicLinkParams = {
  identifier: string;
  url: string;
  provider: {
    /** Nodemailer transport config (connection URL or options object). */
    server: unknown;
    from?: string;
  };
};

/**
 * Russian magic-link email for NextAuth EmailProvider.
 * Throws with a clear message when SMTP rejects the send (so the UI can surface failure).
 */
export async function sendMagicLinkEmail({ identifier, url, provider }: SendMagicLinkParams) {
  const { server, from } = provider;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const transport = createTransport(server as any);
  const host = (() => {
    try {
      return new URL(url).host;
    } catch {
      return "Calorie Vision";
    }
  })();

  try {
    const result = await transport.sendMail({
      to: identifier,
      from: from ?? "noreply@calorievision.ru",
      subject: `Вход в Calorie Vision`,
      text: textBody({ url, host }),
      html: htmlBody({ url, host }),
    });

    const info = result as { rejected?: unknown[]; pending?: unknown[] };
    const rejected = [...(info.rejected ?? []), ...(info.pending ?? [])].filter(Boolean);
    if (rejected.length) {
      throw new Error(`SMTP не принял письмо для: ${rejected.join(", ")}`);
    }

    return result;
  } catch (error) {
    const detail = formatSmtpError(error);
    console.error("[email-auth] SMTP send failed:", detail, error);
    throw new Error(detail);
  }
}

function formatSmtpError(error: unknown): string {
  if (!error || typeof error !== "object") {
    return "Не удалось отправить письмо через SMTP.";
  }

  const err = error as {
    code?: string;
    responseCode?: number;
    response?: string;
    message?: string;
  };

  if (err.code === "EAUTH" || err.responseCode === 535) {
    return "SMTP отклонил логин/пароль. Проверьте EMAIL_SERVER_USER и пароль приложения Яндекса.";
  }
  if (err.code === "ESOCKET" || err.code === "ETIMEDOUT" || err.code === "ECONNECTION") {
    return "Нет связи с SMTP-сервером. Проверьте EMAIL_SERVER_HOST/PORT и исходящий порт 465 на VPS.";
  }
  if (typeof err.response === "string" && err.response.trim()) {
    return `SMTP: ${err.response.trim()}`;
  }
  if (typeof err.message === "string" && err.message.trim()) {
    return err.message.trim();
  }
  return "Не удалось отправить письмо через SMTP.";
}

function textBody({ url, host }: { url: string; host: string }) {
  return [
    "Вход в Calorie Vision",
    "",
    `Перейдите по ссылке, чтобы войти на ${host}:`,
    url,
    "",
    "Ссылка действует 24 часа. Если вы не запрашивали вход — просто игнорируйте письмо.",
  ].join("\n");
}

function htmlBody({ url, host }: { url: string; host: string }) {
  const escapedUrl = escapeHtml(url);
  const escapedHost = escapeHtml(host);
  return `<!DOCTYPE html>
<html lang="ru">
<body style="background:#f4f7fb;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;margin:0;padding:24px;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:480px;margin:0 auto;background:#ffffff;border-radius:16px;padding:28px 24px;border:1px solid #e2e8f0;">
    <tr><td>
      <p style="margin:0;color:#0f766e;font-size:13px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;">Calorie Vision</p>
      <h1 style="margin:12px 0 0;color:#0f172a;font-size:22px;">Вход в аккаунт</h1>
      <p style="margin:12px 0 0;color:#475569;font-size:15px;line-height:1.5;">
        Нажмите кнопку ниже, чтобы войти на <strong>${escapedHost}</strong>. Ссылка действует 24 часа.
      </p>
      <p style="margin:24px 0;">
        <a href="${escapedUrl}" style="display:inline-block;background:#0f766e;color:#ffffff;text-decoration:none;font-weight:600;padding:12px 20px;border-radius:999px;">
          Войти
        </a>
      </p>
      <p style="margin:0;color:#94a3b8;font-size:12px;line-height:1.45;">
        Если кнопка не работает, скопируйте ссылку:<br/>
        <span style="word-break:break-all;color:#64748b;">${escapedUrl}</span>
      </p>
      <p style="margin:16px 0 0;color:#94a3b8;font-size:12px;">
        Если вы не запрашивали вход — игнорируйте это письмо.
      </p>
    </td></tr>
  </table>
</body>
</html>`;
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

/** Prefer discrete SMTP env vars when set (avoids URL-encoding pain in passwords). */
export function resolveEmailServer(): string | Record<string, unknown> | null {
  const host = process.env.EMAIL_SERVER_HOST?.trim();
  const user = process.env.EMAIL_SERVER_USER?.trim();
  const pass = process.env.EMAIL_SERVER_PASSWORD;
  const portRaw = process.env.EMAIL_SERVER_PORT?.trim();

  if (host && user && typeof pass === "string" && pass.length > 0) {
    const port = Number(portRaw || "465");
    const secure =
      process.env.EMAIL_SERVER_SECURE === "true" ||
      process.env.EMAIL_SERVER_SECURE === "1" ||
      port === 465;

    return {
      host,
      port: Number.isFinite(port) ? port : 465,
      secure,
      auth: { user, pass },
    };
  }

  const connection = process.env.EMAIL_SERVER?.trim();
  if (!connection) {
    return null;
  }

  try {
    const parsed = new URL(connection);
    if (!parsed.hostname || !parsed.username || !parsed.password) {
      return null;
    }
  } catch {
    return null;
  }

  return connection;
}

export function isEmailLoginConfigured(): boolean {
  return resolveEmailServer() !== null;
}
