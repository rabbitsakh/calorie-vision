import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth-session";
import { prisma } from "@/lib/prisma";
import { shiftDateKey, toDateKeyTz } from "@/lib/dates";
import { DIET_PROFILE_SELECT, isWeightGoal, recommendDietForProfile, buildGoalAwareCalorieTip, type WeightGoal } from "@/lib/diet";
import { completeChat } from "@/lib/ai/gigachat";
import { weightEntryOrderNewestFirst } from "@/lib/weight-entries";
import { decodeHtmlEntities } from "@/lib/html-text";

export const dynamic = "force-dynamic";

function ruleBasedTip(ctx: {
  streak: number;
  yesterdayCalories: number;
  target: number | null;
  goal: WeightGoal | null;
  topFood: string | null;
  loggedYesterday: boolean;
}): string {
  if (!ctx.loggedYesterday) {
    return "Вчера записей не было — сегодня достаточно одного приёма пищи, чтобы снова войти в ритм.";
  }
  if (ctx.streak >= 7) {
    return `У вас серия ${ctx.streak} дней — отличная привычка. Держите темп: сначала лог, потом правки.`;
  }
  if (ctx.target && ctx.yesterdayCalories > 0) {
    return buildGoalAwareCalorieTip({
      actual: ctx.yesterdayCalories,
      target: ctx.target,
      goal: ctx.goal,
      tense: "yesterday",
    });
  }
  if (ctx.topFood) {
    return `Частое блюдо — «${ctx.topFood}». Можно добавить его в быстрое добавление и сэкономить время.`;
  }
  return "Регулярность важнее идеальных цифр. Запишите следующий приём — и день уже засчитан.";
}

export async function GET() {
  try {
    const { session, response } = await requireSession();
    if (response) return response;

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { timezone: true, ...DIET_PROFILE_SELECT },
    });
    const today = toDateKeyTz(new Date(), user?.timezone);
    const yesterday = shiftDateKey(today, -1);
    const weekStart = shiftDateKey(today, -6);

    const [yesterdayMeals, mealDates, weight, topFoods] = await Promise.all([
      prisma.mealEntry.findMany({
        where: { userId: session.user.id, date: yesterday },
        select: { calories: true },
      }),
      prisma.mealEntry.findMany({
        where: { userId: session.user.id },
        select: { date: true },
        distinct: ["date"],
        take: 60,
        orderBy: { date: "desc" },
      }),
      prisma.weightEntry.findFirst({
        where: { userId: session.user.id },
        orderBy: weightEntryOrderNewestFirst,
      }),
      prisma.mealEntry.groupBy({
        by: ["dishName"],
        where: { userId: session.user.id, date: { gte: weekStart, lte: today } },
        _count: { id: true },
        orderBy: { _count: { id: "desc" } },
        take: 1,
      }),
    ]);

    const dateSet = new Set(mealDates.map((m) => m.date));
    let streak = 0;
    let expected = dateSet.has(today) ? today : yesterday;
    while (dateSet.has(expected)) {
      streak += 1;
      expected = shiftDateKey(expected, -1);
    }

    const yesterdayCalories = yesterdayMeals.reduce((s, m) => s + m.calories, 0);
    const goal = isWeightGoal(user?.goal) ? user!.goal : null;
    const target = recommendDietForProfile(weight?.weightKg, user);
    const topFood = topFoods[0] ? decodeHtmlEntities(topFoods[0].dishName) : null;

    const ctx = {
      streak,
      yesterdayCalories,
      target: target?.calories ?? null,
      goal,
      topFood,
      loggedYesterday: yesterdayMeals.length > 0,
    };

    let tip = ruleBasedTip(ctx);
    let source: "gigachat" | "rules" = "rules";

    if (process.env.GIGACHAT_CREDENTIALS || (process.env.GIGACHAT_CLIENT_ID && process.env.GIGACHAT_CLIENT_SECRET)) {
      try {
        const goalHint =
          goal === "LOSE"
            ? "Цель пользователя — похудение: целевые ккал уже с дефицитом. Не говори «ешь больше», если вчера чуть ниже цели — это нормально. Предупреждай только при сильном недоедании."
            : goal === "GAIN"
              ? "Цель пользователя — набор веса: если ниже цели ккал, мягко предложи добавить еду."
              : "Цель — удержание веса: ориентируйся на норму калорий.";
        const prompt = [
          "Ты — мягкий коуч по привычке вести дневник питания. Ответь ОДНИМ коротким предложением на русском (макс 160 символов).",
          "Без стыда, без диет-экстрима, без списков. Только мотивация и один конкретный маленький шаг.",
          goalHint,
          `Контекст: серия=${ctx.streak}, вчера_ккал=${ctx.yesterdayCalories}, цель_ккал=${ctx.target ?? "нет"}, цель_вес=${goal ?? "нет"}, частое_блюдо=${ctx.topFood ?? "нет"}, вчера_были_записи=${ctx.loggedYesterday}.`,
        ].join("\n");
        const ai = await completeChat([{ role: "user", content: prompt }], 0.6);
        const cleaned = ai.replace(/^["«]|["»]$/g, "").trim();
        if (cleaned.length >= 20 && cleaned.length <= 220) {
          tip = cleaned;
          source = "gigachat";
        }
      } catch {
        // keep rule-based tip
      }
    }

    return NextResponse.json({ tip, source, date: today });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Не удалось загрузить совет" }, { status: 500 });
  }
}
