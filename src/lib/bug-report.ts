/** Pure validation for «Сообщить об ошибке» — no nodemailer / Next imports. */

export const BUG_REPORT_SUPPORT_EMAIL =
  process.env.SUPPORT_EMAIL?.trim() || "support@calorievision.ru";

export const BUG_REPORT_MAX_DESCRIPTION = 4000;
export const BUG_REPORT_MIN_DESCRIPTION = 10;
export const BUG_REPORT_MAX_SCREENSHOT_BYTES = 2_500_000;
export const BUG_REPORT_ALLOWED_MIME = new Set([
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
  "image/gif",
]);

export type BugReportInput = {
  description: string;
  pageUrl?: string | null;
  userAgent?: string | null;
  appVersion?: string | null;
  screenshot?: { mime: string; size: number; filename: string } | null;
};

export type BugReportValidation =
  | { ok: true; description: string; pageUrl: string | null; userAgent: string | null; appVersion: string | null }
  | { ok: false; error: string };

export function normalizeBugDescription(raw: string): string {
  return raw.replace(/\r\n/g, "\n").trim();
}

export function validateBugReport(input: BugReportInput): BugReportValidation {
  const description = normalizeBugDescription(input.description ?? "");
  if (description.length < BUG_REPORT_MIN_DESCRIPTION) {
    return { ok: false, error: "Опишите проблему чуть подробнее (хотя бы пару слов)." };
  }
  if (description.length > BUG_REPORT_MAX_DESCRIPTION) {
    return { ok: false, error: `Описание слишком длинное (макс. ${BUG_REPORT_MAX_DESCRIPTION} символов).` };
  }

  if (input.screenshot) {
    const mime = (input.screenshot.mime || "").toLowerCase().split(";")[0]!.trim();
    if (!BUG_REPORT_ALLOWED_MIME.has(mime)) {
      return { ok: false, error: "Скриншот: нужен JPEG, PNG, WebP или GIF." };
    }
    if (input.screenshot.size <= 0) {
      return { ok: false, error: "Скриншот пустой — выберите другой файл." };
    }
    if (input.screenshot.size > BUG_REPORT_MAX_SCREENSHOT_BYTES) {
      return { ok: false, error: "Скриншот слишком большой (макс. ~2,5 МБ). Сожмите или обрежьте." };
    }
  }

  const pageUrl = input.pageUrl?.trim().slice(0, 500) || null;
  const userAgent = input.userAgent?.trim().slice(0, 400) || null;
  const appVersion = input.appVersion?.trim().slice(0, 40) || null;

  return { ok: true, description, pageUrl, userAgent, appVersion };
}

export function formatBugReportSubject(userLabel: string): string {
  const label = userLabel.trim().slice(0, 60) || "пользователь";
  return `Calorie Vision · ошибка · ${label}`;
}

export function formatBugReportText(params: {
  description: string;
  userId: string;
  userEmail: string | null;
  userName: string | null;
  pageUrl: string | null;
  userAgent: string | null;
  appVersion: string | null;
  hasScreenshot: boolean;
}): string {
  const lines = [
    "Сообщение об ошибке из приложения Calorie Vision",
    "",
    params.description,
    "",
    "—",
    `userId: ${params.userId}`,
    `email: ${params.userEmail || "—"}`,
    `имя: ${params.userName || "—"}`,
    `версия: ${params.appVersion || "—"}`,
    `страница: ${params.pageUrl || "—"}`,
    `user-agent: ${params.userAgent || "—"}`,
    `скриншот: ${params.hasScreenshot ? "приложен" : "нет"}`,
  ];
  return lines.join("\n");
}
