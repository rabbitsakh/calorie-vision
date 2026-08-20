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

function buildTip(
  pctCalories: number,
  deficits: string[],
  eaten: { protein: number; fat: number; carbs: number },
  target: { protein: number; fat: number; carbs: number },
): string {
  if (deficits.length > 0) {
    const main = deficits[0]!;
    if (main.includes("белков")) {
      return `Не хватает белка: ${round1(target.protein - eaten.protein)} г — добавьте куриную грудку, творог или яйца.`;
    }
    if (main.includes("углеводов")) {
      return `Не хватает углеводов: ${round1(target.carbs - eaten.carbs)} г — крупа, хлеб или фрукты помогут.`;
    }
    if (main.includes("жиров")) {
      return `Не хватает жиров: ${round1(target.fat - eaten.fat)} г — орехи, авокадо или ложка масла.`;
    }
  }
  if (pctCalories < 30) return "Вы съели очень мало — не пропускайте полноценный обед или ужин.";
  if (pctCalories < 60) return "Уже больше половины дня, а норма выполнена меньше, чем наполовину. Пора поесть.";
  if (pctCalories >= 95) return "Норма почти выполнена. Если голодны — выбирайте что-то лёгкое: овощи, кефир.";
  return `${pctCalories}% нормы выполнено. Хороший темп!`;
}

export async function GET(request: NextRequest) {
  try {
    const { session, response } = await requireSession();
    if (response) return response;

    const date = request.nextUrl.searchParams.get("date") ?? "";

    const [entries, user, weight] = await Promise.all([
      prisma.mealEntry.findMany({
        where: { userId: session.user.id, date },
        select: { dishName: true, calories: true, protein: true, fat: true, carbs: true, mealType: true },
        orderBy: { createdAt: "asc" },
      }),
      prisma.user.findUnique({
        where: { id: session.user.id },
        select: { goal: true, goalPace: true, sex: true, heightCm: true, birthYear: true, name: true },
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
        reason: "Укажите цель и вес в профиле — тогда смогу рассчитать вашу норму и дать точные рекомендации.",
        tip: "",
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
    const pctCalories = target.calories > 0 ? Math.round((eaten.calories / target.calories) * 100) : 0;

    if (remaining.calories < 50) {
      const over = eaten.calories - target.calories;
      return NextResponse.json({
        suggestions: [],
        eaten,
        target,
        remaining,
        pctCalories,
        reason: over > 50
          ? `Дневная норма выполнена с превышением на ${over} ккал. Завтра постарайтесь уложиться в ${target.calories} ккал.`
          : "Дневная норма выполнена — отличный день! 🎉",
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
    const sexRu = sex === "FEMALE" ? "женщина" : sex === "MALE" ? "мужчина" : "";
    const timeOfDay = getTimeOfDayRu();

    const eatenList = entries.length > 0
      ? entries.map((e) => {
          const parts = [`${decodeHtmlEntities(e.dishName)}: ${e.calories} ккал`];
          if (e.protein) parts.push(`Б${e.protein}г`);
          if (e.fat) parts.push(`Ж${e.fat}г`);
          if (e.carbs) parts.push(`У${e.carbs}г`);
          return parts.join(" ");
        }).join("\n  ")
      : "ещё ничего не ели";

    const deficits: string[] = [];
    if (eaten.protein < target.protein * 0.70) deficits.push(`белков (${remaining.protein} г)`);
    if (eaten.carbs < target.carbs * 0.60) deficits.push(`углеводов (${remaining.carbs} г)`);
    if (eaten.fat < target.fat * 0.60) deficits.push(`жиров (${remaining.fat} г)`);

    const tip = buildTip(pctCalories, deficits, eaten, target);

    const systemPrompt = `Ты опытный диетолог. Ты отвечаешь ТОЛЬКО валидным JSON-массивом из 3 элементов, без пояснений, без markdown.`;

    const userPrompt = `Пользователь: ${sexRu ? `${sexRu}, ` : ""}вес ${weight.weightKg} кг, цель — ${goalRu}.
Время суток: ${timeOfDay}.
Дневная норма: ${target.calories} ккал | Б ${target.protein} г | Ж ${target.fat} г | У ${target.carbs} г

Сегодня съедено (${pctCalories}%):
  ${eatenList}
Итого: ${eaten.calories} ккал | Б ${eaten.protein} г | Ж ${eaten.fat} г | У ${eaten.carbs} г

Остаток: ${remaining.calories} ккал | Б ${remaining.protein} г | Ж ${remaining.fat} г | У ${remaining.carbs} г
${deficits.length ? `Главный дефицит: ${deficits.join(", ")}` : ""}

Предложи РОВНО 3 конкретных блюда/продукта:
- Подходящих для России и времени суток (${timeOfDay})
- Покрывающих дефицит макронутриентов
- Реалистичных по приготовлению
- Разнообразных (не три одинаковых типа)

Для каждого укажи ТОЧНЫЕ нутриенты для указанной порции.

Верни JSON-массив (без markdown, без пояснений вне массива):
[{"name":"Куриная грудка отварная","calories":185,"protein":35.0,"fat":4.0,"carbs":0.0,"portionGrams":150,"why":"Закроет ${remaining.protein > 20 ? Math.min(35, remaining.protein) : remaining.protein} г белка из остатка","category":"protein"},...]
category: protein | carbs | fat | balanced | light`;

    let suggestions: Suggestion[] = [];

    try {
      const { completeChat } = await import("@/lib/ai/gigachat");
      const raw = await completeChat([
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ], 0.5);

      // Parse — find JSON array anywhere in response
      const match = raw.match(/\[[\s\S]*\]/);
      if (match) {
        const parsed = JSON.parse(match[0]) as unknown[];
        suggestions = parsed
          .filter((item): item is Suggestion =>
            typeof item === "object" && item !== null &&
            typeof (item as Record<string, unknown>).name === "string" &&
            typeof (item as Record<string, unknown>).calories === "number",
          )
          .map((item) => ({
            name: String((item as Record<string, unknown>).name),
            calories: Math.round(Number((item as Record<string, unknown>).calories)),
            protein: Number((item as Record<string, unknown>).protein) || 0,
            fat: Number((item as Record<string, unknown>).fat) || 0,
            carbs: Number((item as Record<string, unknown>).carbs) || 0,
            portionGrams: Number((item as Record<string, unknown>).portionGrams) || 0,
            why: String((item as Record<string, unknown>).why || ""),
            category: (["protein","carbs","fat","balanced","light"].includes(String((item as Record<string, unknown>).category))
              ? (item as Record<string, unknown>).category
              : "balanced") as Suggestion["category"],
          }))
          .slice(0, 3);
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
