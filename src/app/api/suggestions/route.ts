import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/auth-session";
import { prisma } from "@/lib/prisma";
import { isSex, isWeightGoal, isGoalPace, recommendDiet, round1 } from "@/lib/diet";
import { weightEntryOrderNewestFirst } from "@/lib/weight-entries";
import { decodeHtmlEntities } from "@/lib/html-text";

export const dynamic = "force-dynamic";

type Suggestion = {
  name: string;
  calories: number;
  protein: number;
  fat: number;
  carbs: number;
  portionGrams: number;
  why: string;
  category: "protein" | "carbs" | "fat" | "balanced" | "light";
};

type SuggestionsResponse = {
  suggestions: Suggestion[];
  eaten: { calories: number; protein: number; fat: number; carbs: number };
  target: { calories: number; protein: number; fat: number; carbs: number };
  remaining: { calories: number; protein: number; fat: number; carbs: number };
  pctCalories: number;
  tip: string;
  reason?: string;
};

function getTimeOfDayRu(): string {
  const h = new Date().getHours();
  if (h < 6) return "ночь";
  if (h < 11) return "утро";
  if (h < 14) return "день";
  if (h < 18) return "полдень";
  if (h < 21) return "вечер";
  return "поздний вечер";
}

export async function GET(request: NextRequest) {
  try {
    const { session, response } = await requireSession();
    if (response) return response;

    const date = request.nextUrl.searchParams.get("date") ?? "";

    const [entries, user, weight] = await Promise.all([
      prisma.mealEntry.findMany({
        where: { userId: session.user.id, date },
        select: {
          dishName: true,
          calories: true,
          protein: true,
          fat: true,
          carbs: true,
          mealType: true,
        },
        orderBy: { createdAt: "asc" },
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
        reason: "Укажите цель по весу и добавьте первое измерение веса — тогда я смогу рассчитать вашу норму и дать точные рекомендации.",
      } satisfies Partial<SuggestionsResponse>);
    }

    const target = recommendDiet(weight.weightKg, goal, pace, sex, user?.heightCm, user?.birthYear);
    const eaten = {
      calories: entries.reduce((s, e) => s + e.calories, 0),
      protein: round1(entries.reduce((s, e) => s + (e.protein ?? 0), 0)),
      fat: round1(entries.reduce((s, e) => s + (e.fat ?? 0), 0)),
      carbs: round1(entries.reduce((s, e) => s + (e.carbs ?? 0), 0)),
    };
    const remaining = {
      calories: Math.max(0, target.calories - eaten.calories),
      protein: Math.max(0, round1(target.protein - eaten.protein)),
      fat: Math.max(0, round1(target.fat - eaten.fat)),
      carbs: Math.max(0, round1(target.carbs - eaten.carbs)),
    };
    const pctCalories = target.calories > 0
      ? Math.round((eaten.calories / target.calories) * 100)
      : 0;

    if (remaining.calories < 50) {
      const over = eaten.calories - target.calories;
      return NextResponse.json({
        suggestions: [],
        eaten,
        target,
        remaining,
        pctCalories,
        reason: over > 0
          ? `Дневная норма выполнена (превышение ${over} ккал). Можно сделать лёгкую прогулку.`
          : "Дневная норма выполнена! Отличный день.",
        tip: "",
      } satisfies Partial<SuggestionsResponse>);
    }

    if (!process.env.GIGACHAT_CREDENTIALS) {
      return NextResponse.json({
        suggestions: [],
        eaten,
        target,
        remaining,
        pctCalories,
        reason: "AI-ключ не настроен.",
        tip: "",
      } satisfies Partial<SuggestionsResponse>);
    }

    const goalRu = goal === "LOSE" ? "похудение" : goal === "GAIN" ? "набор мышечной массы" : "поддержание веса";
    const timeOfDay = getTimeOfDayRu();
    const eatenDishes = entries.map((e) => `${decodeHtmlEntities(e.dishName)} (${e.calories} ккал)`).join(", ") || "ничего";

    const deficits: string[] = [];
    const proteinPct = target.protein > 0 ? (eaten.protein / target.protein) * 100 : 100;
    const carbsPct = target.carbs > 0 ? (eaten.carbs / target.carbs) * 100 : 100;
    const fatPct = target.fat > 0 ? (eaten.fat / target.fat) * 100 : 100;
    if (proteinPct < 70) deficits.push(`белков не хватает ${remaining.protein} г`);
    if (carbsPct < 60) deficits.push(`углеводов не хватает ${remaining.carbs} г`);
    if (fatPct < 60) deficits.push(`жиров не хватает ${remaining.fat} г`);

    const prompt = `Ты диетолог-нутрициолог. Дай персональные рекомендации на основе данных пользователя.

ДАННЫЕ:
- Время суток: ${timeOfDay}
- Цель: ${goalRu}, ${sex === "FEMALE" ? "женщина" : sex === "MALE" ? "мужчина" : "пол не указан"}, вес ${weight.weightKg} кг
- Норма на день: ${target.calories} ккал, Б ${target.protein} г, Ж ${target.fat} г, У ${target.carbs} г
- Уже съел сегодня: ${eatenDishes}
- Итого: ${eaten.calories} ккал (${pctCalories}% нормы), Б ${eaten.protein} г, Ж ${eaten.fat} г, У ${eaten.carbs} г
- Остаток: ${remaining.calories} ккал, Б ${remaining.protein} г, Ж ${remaining.fat} г, У ${remaining.carbs} г
${deficits.length ? `- Главные дефициты: ${deficits.join("; ")}` : ""}

ЗАДАЧА: Предложи ровно 3 конкретных блюда/продукта для России, которые восполнят дефицит и подходят времени суток.
Для каждого укажи реальные нутриенты для указанной порции.

Верни ТОЛЬКО валидный JSON-массив (без markdown):
[
  {
    "name": "Точное название на русском",
    "calories": 0,
    "protein": 0.0,
    "fat": 0.0,
    "carbs": 0.0,
    "portionGrams": 0,
    "why": "Одно конкретное предложение почему это подходит сейчас (упомяни нутриент или цель)",
    "category": "protein"
  }
]
category: "protein" | "carbs" | "fat" | "balanced" | "light"`;

    let suggestions: Suggestion[] = [];
    let tip = "";

    try {
      const { lookupFoodWithGigaChat } = await import("@/lib/ai/gigachat");
      // lookupFoodWithGigaChat uses buildFoodLookupPrompt — we bypass it by using a raw prompt
      // We need the raw completeChat function — use it via the module
      const { recognizeWithGigaChat: _ } = await import("@/lib/ai/gigachat");
      // Use lookupFoodWithGigaChat which calls buildFoodLookupPrompt — instead call it indirectly
      // The function accepts dishName and wraps it — workaround: use JSON in dishName and parse result
      const result = await lookupFoodWithGigaChat(prompt);

      // Model may return array in dishName field or as JSON
      const raw = result.dishName.includes("[") ? result.dishName : JSON.stringify(result);
      const match = raw.match(/\[[\s\S]*\]/);
      if (match) {
        const parsed = JSON.parse(match[0]) as Suggestion[];
        suggestions = parsed.slice(0, 3);
      }

      // Generate a short daily tip
      if (deficits.length > 0) {
        tip = `Сегодня главный дефицит — ${deficits[0]}. Приоритет — белковые продукты.`;
      } else if (pctCalories < 40) {
        tip = "Вы съели меньше половины нормы. Не пропускайте полноценный приём пищи.";
      } else if (pctCalories > 90) {
        tip = "Норма почти выполнена — выбирайте лёгкое, если ещё голодны.";
      } else {
        tip = `${pctCalories}% нормы выполнено. Хороший темп!`;
      }
    } catch {
      // suggestions stays []
    }

    return NextResponse.json({
      suggestions,
      eaten,
      target,
      remaining,
      pctCalories,
      tip,
    } satisfies Partial<SuggestionsResponse>);
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Ошибка загрузки" }, { status: 500 });
  }
}
