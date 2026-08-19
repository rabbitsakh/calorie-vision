import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/auth-session";
import { prisma } from "@/lib/prisma";
import { isSex, isWeightGoal, isGoalPace, recommendDiet } from "@/lib/diet";
import { lookupFoodWithGigaChat } from "@/lib/ai/gigachat";
import { weightEntryOrderNewestFirst } from "@/lib/weight-entries";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const { session, response } = await requireSession();
    if (response) return response;

    const date = request.nextUrl.searchParams.get("date") ?? "";

    const [entries, user, weight] = await Promise.all([
      prisma.mealEntry.findMany({
        where: { userId: session.user.id, date },
        select: { calories: true, protein: true, fat: true, carbs: true },
      }),
      prisma.user.findUnique({
        where: { id: session.user.id },
        select: { goal: true, goalPace: true, sex: true, heightCm: true, birthYear: true },
      }),
      prisma.weightEntry.findFirst({
        where: { userId: session.user.id },
        orderBy: weightEntryOrderNewestFirst,
      }),
    ]);

    const goal = isWeightGoal(user?.goal) ? user!.goal : null;
    const pace = isGoalPace(user?.goalPace) ? user!.goalPace : null;
    const sex = isSex(user?.sex) ? user!.sex : null;

    if (!goal || !weight) {
      return NextResponse.json({
        suggestions: [],
        reason: "Укажите цель и вес в профиле, чтобы получить рекомендации.",
      });
    }

    const target = recommendDiet(weight.weightKg, goal, pace, sex, user?.heightCm, user?.birthYear);
    const eaten = {
      calories: entries.reduce((s, e) => s + e.calories, 0),
      protein: entries.reduce((s, e) => s + (e.protein ?? 0), 0),
      fat: entries.reduce((s, e) => s + (e.fat ?? 0), 0),
      carbs: entries.reduce((s, e) => s + (e.carbs ?? 0), 0),
    };

    const remaining = {
      calories: Math.max(0, target.calories - eaten.calories),
      protein: Math.max(0, target.protein - eaten.protein),
      fat: Math.max(0, target.fat - eaten.fat),
      carbs: Math.max(0, target.carbs - eaten.carbs),
    };

    if (remaining.calories < 100) {
      return NextResponse.json({ suggestions: [], reason: "Дневная норма выполнена!" });
    }

    if (!process.env.GIGACHAT_CREDENTIALS) {
      return NextResponse.json({ suggestions: [], reason: "AI-ключ не настроен." });
    }

    const prompt = `Пользователю осталось за день: ${remaining.calories} ккал, белки ${Math.round(remaining.protein)} г, жиры ${Math.round(remaining.fat)} г, углеводы ${Math.round(remaining.carbs)} г.
Цель: ${goal === "LOSE" ? "похудение" : goal === "GAIN" ? "набор веса" : "поддержание"}.
Предложи 3 конкретных блюда или продукта подходящих для России, каждое в формате JSON-массива:
[{"name":"...", "calories":0, "why":"коротко почему подходит"}]
Верни ТОЛЬКО JSON-массив.`;

    let suggestions: Array<{ name: string; calories: number; why: string }> = [];
    try {
      const result = await lookupFoodWithGigaChat(prompt);
      // The result comes back as a FoodRecognitionResult — we passed a custom prompt
      // The model may embed the array in dishName or return invalid JSON — parse defensively
      const raw = result.dishName;
      const match = raw.match(/\[[\s\S]*\]/);
      if (match) {
        suggestions = JSON.parse(match[0]) as typeof suggestions;
      }
    } catch {
      // suggestions stays []
    }

    return NextResponse.json({ suggestions: suggestions.slice(0, 3), remaining });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Ошибка загрузки" }, { status: 500 });
  }
}
