import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  BUG_REPORT_SUPPORT_EMAIL,
  formatBugReportSubject,
  formatBugReportText,
  validateBugReport,
} from "./bug-report.ts";

describe("validateBugReport", () => {
  it("rejects short description", () => {
    const r = validateBugReport({ description: "баг" });
    assert.equal(r.ok, false);
  });

  it("accepts text-only report", () => {
    const r = validateBugReport({
      description: "Не сохраняется вода после офлайна",
      pageUrl: "https://calorievision.ru/ration/",
    });
    assert.equal(r.ok, true);
    if (r.ok) assert.match(r.description, /вода/);
  });

  it("rejects oversized screenshot", () => {
    const r = validateBugReport({
      description: "Кнопка не нажимается на экране подтверждения",
      screenshot: { mime: "image/png", size: 5_000_000, filename: "a.png" },
    });
    assert.equal(r.ok, false);
  });

  it("rejects bad mime", () => {
    const r = validateBugReport({
      description: "Кнопка не нажимается на экране подтверждения",
      screenshot: { mime: "application/pdf", size: 100, filename: "a.pdf" },
    });
    assert.equal(r.ok, false);
  });
});

describe("bug report mail helpers", () => {
  it("default support inbox", () => {
    assert.equal(BUG_REPORT_SUPPORT_EMAIL, "support@calorievision.ru");
  });

  it("formats subject and body", () => {
    assert.match(formatBugReportSubject("anna@x.ru"), /ошибка/);
    const text = formatBugReportText({
      description: "Тест",
      userId: "u1",
      userEmail: "a@b.c",
      userName: "Анна",
      pageUrl: "/ration/",
      userAgent: "TestAgent",
      appVersion: "3.1.7",
      hasScreenshot: true,
    });
    assert.match(text, /u1/);
    assert.match(text, /приложен/);
  });
});
