import { createTransport } from "nodemailer";
import { prisma } from "@/lib/prisma";
import { dateRangeEnding, shiftDateKey, toDateKeyTz } from "@/lib/dates";
import { DIET_PROFILE_SELECT, recommendDietForProfile } from "@/lib/diet";
import { resolveEmailServer } from "@/lib/email-auth";
import { weightEntryOrderNewestFirst } from "@/lib/weight-entries";
import { WATER_HABIT_DAY_ML } from "@/lib/water-target";

export type WeeklyDigestSummary = {
  weekLabel: string;
  daysLogged: number;
  avgCalories: number;
  avgWaterMl: number;
  calorieTarget: number | null;
  insights: string[];
};

function formatWeekRange(start: string, end: string): string {
  const fmt = (key: string) => {
    const d = new Date(key + "T12:00:00Z");
    return new Intl.DateTimeFormat("ru-RU", { day: "numeric", month: "short" }).format(d);
  };
  return `${fmt(start)} — ${fmt(end)}`;
}

/** Compact weekly stats for email digest (mirrors /api/weekly-report). */
export async function loadWeeklyDigestSummary(
  userId: string,
  endDate?: string,
): Promise<WeeklyDigestSummary> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { timezone: true, ...DIET_PROFILE_SELECT },
  });

  const end = endDate ?? toDateKeyTz(new Date(), user?.timezone);
  const dates = dateRangeEnding(end, 7);
  const start = dates[0]!;

  const [meals, waterEntries, weight] = await Promise.all([
    prisma.mealEntry.findMany({
      where: { userId, date: { gte: start, lte: end } },
      select: { date: true, calories: true },
    }),
    prisma.waterEntry.findMany({
      where: { userId, date: { gte: start, lte: end } },
      select: { date: true, ml: true },
    }),
    prisma.weightEntry.findFirst({
      where: { userId },
      orderBy: weightEntryOrderNewestFirst,
    }),
  ]);

  const caloriesByDate = new Map<string, number>();
  for (const m of meals) {
    caloriesByDate.set(m.date, (caloriesByDate.get(m.date) ?? 0) + m.calories);
  }
  const waterByDate = new Map<string, number>();
  for (const w of waterEntries) {
    waterByDate.set(w.date, (waterByDate.get(w.date) ?? 0) + w.ml);
  }

  const daysWithMeals = dates.filter((d) => (caloriesByDate.get(d) ?? 0) > 0);
  const totalCalories = meals.reduce((s, m) => s + m.calories, 0);
  const avgCalories =
    daysWithMeals.length > 0 ? Math.round(totalCalories / daysWithMeals.length) : 0;

  const waterDays = dates.filter((d) => (waterByDate.get(d) ?? 0) > 0);
  const avgWaterMl =
    waterDays.length > 0
      ? Math.round(waterDays.reduce((s, d) => s + (waterByDate.get(d) ?? 0), 0) / waterDays.length)
      : 0;

  const target = recommendDietForProfile(weight?.weightKg, user);

  const insights: string[] = [];
  if (daysWithMeals.length >= 5) {
    insights.push(`Дневник: ${daysWithMeals.length} из 7 дней — отличная регулярность.`);
  } else if (daysWithMeals.length > 0) {
    insights.push(`Записи ${daysWithMeals.length} дней из 7 — можно чаще фиксировать еду.`);
  } else {
    insights.push("На прошлой неделе ещё не было записей еды.");
  }

  if (target && avgCalories > 0) {
    const diff = avgCalories - target.calories;
    if (Math.abs(diff) <= target.calories * 0.08) {
      insights.push(`Среднее ${avgCalories} ккал/день — близко к цели (${target.calories}).`);
    } else if (diff > 0) {
      insights.push(`Среднее ${avgCalories} ккал/день (+${Math.round(diff)} к цели ${target.calories}).`);
    } else {
      insights.push(`Среднее ${avgCalories} ккал/день (${Math.round(diff)} к цели ${target.calories}).`);
    }
  } else if (avgCalories > 0) {
    insights.push(`Среднее ${avgCalories} ккал/день.`);
  }

  if (avgWaterMl >= WATER_HABIT_DAY_ML) {
    insights.push(`Вода: в среднем ${avgWaterMl} мл/день — хороший результат.`);
  } else if (avgWaterMl > 0) {
    insights.push(`Вода: в среднем ${avgWaterMl} мл/день.`);
  }

  return {
    weekLabel: formatWeekRange(start, end),
    daysLogged: daysWithMeals.length,
    avgCalories,
    avgWaterMl,
    calorieTarget: target?.calories ?? null,
    insights,
  };
}

export function formatWeeklyDigestText(summary: WeeklyDigestSummary, name?: string | null): string {
  const hello = name?.trim() ? `Здравствуйте, ${name.trim().split(/\s+/)[0]}!` : "Здравствуйте!";
  return [
    hello,
    "",
    `Недельный итог Calorie Vision (${summary.weekLabel})`,
    "",
    `Дней с записями: ${summary.daysLogged}`,
    `Средние калории: ${summary.avgCalories || "—"}`,
    summary.calorieTarget != null ? `Цель: ${summary.calorieTarget} ккал` : null,
    summary.avgWaterMl > 0 ? `Средняя вода: ${summary.avgWaterMl} мл` : null,
    "",
    ...summary.insights,
    "",
    "Открыть рацион: https://calorievision.ru/ration",
    "Отключить дайджест можно в профиле.",
  ]
    .filter((line) => line != null)
    .join("\n");
}

export function formatWeeklyDigestHtml(summary: WeeklyDigestSummary, name?: string | null): string {
  const hello = name?.trim()
    ? `Здравствуйте, ${escapeHtml(name.trim().split(/\s+/)[0]!)}!`
    : "Здравствуйте!";
  const insights = summary.insights
    .map(
      (line) =>
        `<li style="margin:0 0 6px;color:#475569;font-size:14px;line-height:1.45;">${escapeHtml(line)}</li>`,
    )
    .join("");
  return `<!DOCTYPE html>
<html lang="ru">
<body style="background:#f4f7fb;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;margin:0;padding:24px;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:480px;margin:0 auto;background:#ffffff;border-radius:16px;padding:28px 24px;border:1px solid #e2e8f0;">
    <tr><td>
      <p style="margin:0;color:#0f766e;font-size:13px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;">Calorie Vision</p>
      <h1 style="margin:12px 0 0;color:#0f172a;font-size:22px;">Недельный итог</h1>
      <p style="margin:8px 0 0;color:#64748b;font-size:14px;">${escapeHtml(summary.weekLabel)}</p>
      <p style="margin:16px 0 0;color:#334155;font-size:15px;">${hello}</p>
      <p style="margin:12px 0 0;color:#475569;font-size:15px;line-height:1.5;">
        Дней с записями: <strong>${summary.daysLogged}</strong><br/>
        Средние калории: <strong>${summary.avgCalories || "—"}</strong>
        ${summary.calorieTarget != null ? `<br/>Цель: <strong>${summary.calorieTarget}</strong> ккал` : ""}
        ${summary.avgWaterMl > 0 ? `<br/>Средняя вода: <strong>${summary.avgWaterMl}</strong> мл` : ""}
      </p>
      <ul style="margin:16px 0 0;padding-left:18px;">${insights}</ul>
      <p style="margin:24px 0;">
        <a href="https://calorievision.ru/ration" style="display:inline-block;background:#0f766e;color:#ffffff;text-decoration:none;font-weight:600;padding:12px 20px;border-radius:999px;">
          Открыть рацион
        </a>
      </p>
      <p style="margin:0;color:#94a3b8;font-size:12px;">Отключить дайджест можно в профиле приложения.</p>
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

export async function sendWeeklyDigestEmail(params: {
  to: string;
  summary: WeeklyDigestSummary;
  name?: string | null;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const server = resolveEmailServer();
  if (!server) {
    return { ok: false, error: "EMAIL_SERVER не настроен" };
  }

  const from = process.env.EMAIL_FROM?.trim() || "noreply@calorievision.ru";
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const transport = createTransport(server as any);

  try {
    await transport.sendMail({
      to: params.to,
      from,
      subject: `Недельный итог Calorie Vision · ${params.summary.weekLabel}`,
      text: formatWeeklyDigestText(params.summary, params.name),
      html: formatWeeklyDigestHtml(params.summary, params.name),
    });
    return { ok: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : "SMTP error";
    return { ok: false, error: message };
  }
}

/** Previous calendar day end for digest window (yesterday in user TZ). */
export function digestEndDateForTimezone(timezone: string | null | undefined): string {
  const today = toDateKeyTz(new Date(), timezone);
  return shiftDateKey(today, -1);
}
