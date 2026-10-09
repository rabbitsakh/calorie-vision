import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/auth-session";
import { completeChat } from "@/lib/ai/gigachat";
import { mondayOfWeek, requireDateKey, shiftDateKey, toDateKeyTz } from "@/lib/dates";
import { DIET_PROFILE_SELECT, recommendDietForProfile, round1 } from "@/lib/diet";
import { prisma } from "@/lib/prisma";
import { buildStreakPayload } from "@/lib/streak-payload";
import { weightEntryOrderNewestFirst } from "@/lib/weight-entries";
import {
  buildWeeklyGymRationDigest,
  ruleWeeklyDigestTip,
  type WeeklyGymRationContext,
} from "@/lib/weekly-gym-ration-digest";
import { serializeSessionSummary, sessionInclude } from "@/lib/workouts/serialize";
import { aggregatePeriod, trendPct } from "@/lib/workouts/trends";

export const dynamic = "force-dynamic";

function formatWeekRange(start: string, end: string): string {
  const fmt = (key: string) => {
    const d = new Date(key + "T12:00:00Z");
    return new Intl.DateTimeFormat("ru-RU", { day: "numeric", month: "short" }).format(d);
  };
  return `${fmt(start)} — ${fmt(end)}`;
}

/**
 * GET ?end=YYYY-MM-DD
 * → Mon–Sun gym+ration digest: headline + 1–2 steps (+ optional GigaChat tip).
 */
export async function GET(request: NextRequest) {
  try {
    const { session, response } = await requireSession();
    if (response) return response;

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { timezone: true, ...DIET_PROFILE_SELECT },
    });

    const endParam = request.nextUrl.searchParams.get("end");
    const endDate = endParam ? requireDateKey(endParam) : null;
    const today = toDateKeyTz(new Date(), user?.timezone);
    const anchor = endDate ?? today;
    const weekStart = mondayOfWeek(anchor);
    const weekEnd = shiftDateKey(weekStart, 6);
    const prevWeekStart = shiftDateKey(weekStart, -7);
    const prevWeekEnd = shiftDateKey(weekStart, -1);
    const dates = Array.from({ length: 7 }, (_, i) => shiftDateKey(weekStart, i));

    const [meals, weight, history, streakPayload] = await Promise.all([
      prisma.mealEntry.findMany({
        where: {
          userId: session.user.id,
          date: { gte: weekStart, lte: weekEnd },
        },
        select: { date: true, calories: true, protein: true },
      }),
      prisma.weightEntry.findFirst({
        where: { userId: session.user.id },
        orderBy: weightEntryOrderNewestFirst,
      }),
      prisma.workoutSession.findMany({
        where: {
          userId: session.user.id,
          date: { gte: prevWeekStart, lte: weekEnd },
        },
        include: sessionInclude,
        orderBy: [{ date: "desc" }, { createdAt: "desc" }],
        take: 80,
      }),
      buildStreakPayload(session.user.id, today),
    ]);

    const caloriesByDate = new Map<string, number>();
    const proteinByDate = new Map<string, number>();
    for (const m of meals) {
      caloriesByDate.set(m.date, (caloriesByDate.get(m.date) ?? 0) + m.calories);
      proteinByDate.set(m.date, (proteinByDate.get(m.date) ?? 0) + (m.protein ?? 0));
    }
    const daysWithMeals = dates.filter((d) => (caloriesByDate.get(d) ?? 0) > 0);
    const totalCalories = meals.reduce((s, m) => s + m.calories, 0);
    const totalProtein = meals.reduce((s, m) => s + (m.protein ?? 0), 0);
    const avgCalories =
      daysWithMeals.length > 0 ? Math.round(totalCalories / daysWithMeals.length) : 0;
    const avgProtein =
      daysWithMeals.length > 0 ? round1(totalProtein / daysWithMeals.length) : 0;

    const target = recommendDietForProfile(weight?.weightKg, user);

    const summaries = history.map(serializeSessionSummary);
    const periodSessions = summaries.map((s) => ({
      date: s.date,
      totalLoad: s.totalLoad,
      loadByGroup: s.loadByGroup,
      cardioDistanceKm: s.cardioDistanceKm,
      cardioDurationSec: s.cardioDurationSec,
    }));
    const week = aggregatePeriod(periodSessions, weekStart, weekEnd);
    const prevWeek = aggregatePeriod(periodSessions, prevWeekStart, prevWeekEnd);

    const ctx: WeeklyGymRationContext = {
      weekLabel: formatWeekRange(weekStart, weekEnd),
      daysLogged: daysWithMeals.length,
      avgCalories,
      calorieTarget: target?.calories ?? null,
      avgProtein,
      proteinTarget: target?.protein ?? null,
      sessionCount: week.sessionCount,
      weeklyTonnage: week.tonnage,
      weekTrendPct: trendPct(week.tonnage, prevWeek.tonnage),
      streak: streakPayload.streak ?? 0,
    };

    const digest = buildWeeklyGymRationDigest(ctx);
    if (!digest) {
      return NextResponse.json({
        weekStart,
        weekEnd,
        weekLabel: ctx.weekLabel,
        digest: null,
        tip: null,
        source: "rules" as const,
        context: {
          daysLogged: ctx.daysLogged,
          sessionCount: ctx.sessionCount,
        },
      });
    }

    let tip = ruleWeeklyDigestTip(digest);
    let source: "gigachat" | "rules" = "rules";
    let headline = digest.headline;

    const hasCreds = Boolean(
      process.env.GIGACHAT_CREDENTIALS?.trim() ||
        (process.env.GIGACHAT_CLIENT_ID?.trim() &&
          process.env.GIGACHAT_CLIENT_SECRET?.trim()),
    );

    if (hasCreds) {
      try {
        const prompt = [
          "Ты — мягкий коуч по привычкам: зал + дневник питания. Ответь ОДНИМ коротким предложением на русском (макс 140 символов).",
          "Без стыда, без диет-экстрима, без списков. Один конкретный шаг на следующую неделю.",
          "Не выдумывай упражнения и цифры — опирайся только на контекст.",
          `Неделя: ${ctx.weekLabel}. Дневник ${ctx.daysLogged}/7, ср.ккал=${ctx.avgCalories}, цель_ккал=${ctx.calorieTarget ?? "нет"}, ср.белок=${ctx.avgProtein}, цель_белок=${ctx.proteinTarget ?? "нет"}, тренировок=${ctx.sessionCount}, тоннаж=${ctx.weeklyTonnage}, тренд_тоннажа%=${ctx.weekTrendPct ?? "нет"}, серия=${ctx.streak}.`,
          `Уже выбранный фокус: ${digest.headline}. Шаги: ${digest.steps.join(" | ")}.`,
        ].join("\n");
        const ai = await completeChat([{ role: "user", content: prompt }], 0.5, {
          retries: 1,
        });
        const cleaned = ai.replace(/^["«]|["»]$/g, "").trim();
        if (cleaned.length >= 16 && cleaned.length <= 200) {
          tip = cleaned;
          source = "gigachat";
          // Soften headline only when AI is clearly a short title-like line.
          if (cleaned.length <= 48 && !cleaned.includes(".")) {
            headline = cleaned;
          }
        }
      } catch {
        // keep rules
      }
    }

    return NextResponse.json({
      weekStart,
      weekEnd,
      weekLabel: ctx.weekLabel,
      digest: { headline, steps: digest.steps },
      tip,
      source,
      context: {
        daysLogged: ctx.daysLogged,
        sessionCount: ctx.sessionCount,
        avgProtein: ctx.avgProtein,
        proteinTarget: ctx.proteinTarget,
        weeklyTonnage: ctx.weeklyTonnage,
      },
    });
  } catch (error) {
    console.error("GET /api/weekly-digest-tip", error);
    return NextResponse.json({ error: "Не удалось загрузить недельный фокус" }, { status: 500 });
  }
}
