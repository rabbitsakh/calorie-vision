import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth-session";
import { prisma } from "@/lib/prisma";
import { shiftDateKey, toDateKeyTz } from "@/lib/dates";
import { isSex, isWeightGoal, isGoalPace, recommendDiet } from "@/lib/diet";
import { completeChat } from "@/lib/ai/gigachat";
import { weightEntryOrderNewestFirst } from "@/lib/weight-entries";
import { decodeHtmlEntities } from "@/lib/html-text";

export const dynamic = "force-dynamic";

function ruleBasedTip(ctx: {
  streak: number;
  yesterdayCalories: number;
  target: number | null;
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
    const diff = ctx.yesterdayCalories - ctx.target;
    if (Math.abs(diff) <= ctx.target * 0.08) {
      return "Вчера вы были близко к цели по калориям. Повторите тот же ритм приёмов сегодня.";
    }
    if (diff > 0) {
      return `Вчера было чуть больше цели (+${Math.round(diff)} ккал). Сегодня можно начать с белка и овощей.`;
    }
    return `Вчера не хватило ${Math.round(-diff)} ккал до цели — не забывайте про перекус.`;
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
      select: { timezone: true, goal: true, goalPace: true, sex: true, heightCm: true, birthYear: true },
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
    const goalPace = isGoalPace(user?.goalPace) ? user!.goalPace : null;
    const sex = isSex(user?.sex) ? user!.sex : null;
    const target =
      goal && weight
        ? recommendDiet(weight.weightKg, goal, goalPace, sex, user?.heightCm, user?.birthYear)
        : null;
    const topFood = topFoods[0] ? decodeHtmlEntities(topFoods[0].dishName) : null;

    const ctx = {
      streak,
      yesterdayCalories,
      target: target?.calories ?? null,
      topFood,
      loggedYesterday: yesterdayMeals.length > 0,
    };

    let tip = ruleBasedTip(ctx);
    let source: "gigachat" | "rules" = "rules";

    if (process.env.GIGACHAT_CREDENTIALS || (process.env.GIGACHAT_CLIENT_ID && process.env.GIGACHAT_CLIENT_SECRET)) {
      try {
        const prompt = [
          "Ты — мягкий коуч по привычке вести дневник питания. Ответь ОДНИМ коротким предложением на русском (макс 160 символов).",
          "Без стыда, без диет-экстрима, без списков. Только мотивация и один конкретный маленький шаг.",
          `Контекст: серия=${ctx.streak}, вчера_ккал=${ctx.yesterdayCalories}, цель_ккал=${ctx.target ?? "нет"}, частое_блюдо=${ctx.topFood ?? "нет"}, вчера_были_записи=${ctx.loggedYesterday}.`,
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
