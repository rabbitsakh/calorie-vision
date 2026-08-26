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


/** Concrete fallback dishes when AI is unavailable — always 3 ideas. */
function buildFallbackSuggestions(
  remaining: { calories: number; protein: number; fat: number; carbs: number },
): Suggestion[] {
  const kcal = Math.max(80, remaining.calories);
  const ideas: Suggestion[] = [];

  if (remaining.protein >= 15 || remaining.calories >= 200) {
    const portion = Math.min(200, Math.max(100, Math.round((remaining.protein || 25) * 5)));
    const cal = Math.min(kcal, Math.round(portion * 1.1));
    ideas.push({
      name: "Куриная грудка с овощами",
      calories: cal,
      protein: round1(portion * 0.23),
      fat: round1(portion * 0.03),
      carbs: round1(portion * 0.04),
      portionGrams: portion,
      why: `Закроет около ${Math.min(remaining.protein, Math.round(portion * 0.23))} г белка из остатка`,
      category: "protein",
    });
  }

  if (remaining.carbs >= 20 || ideas.length < 2) {
    const portion = Math.min(180, Math.max(80, Math.round(remaining.carbs * 2.5) || 120));
    const cal = Math.min(Math.max(0, kcal - (ideas[0]?.calories ?? 0)), Math.round(portion * 1.2));
    ideas.push({
      name: "Гречка с маслом",
      calories: Math.max(120, cal),
      protein: round1(portion * 0.04),
      fat: round1(portion * 0.03 + 5),
      carbs: round1(portion * 0.2),
      portionGrams: portion,
      why: "Углеводы и сытость без перегруза",
      category: "carbs",
    });
  }

  while (ideas.length < 3) {
    const lightCal = Math.min(180, Math.max(80, Math.round(kcal / (4 - ideas.length))));
    if (ideas.length === 1) {
      ideas.push({
        name: "Творог 5% со свежими ягодами",
        calories: lightCal,
        protein: 18,
        fat: 5,
        carbs: 12,
        portionGrams: 150,
        why: "Белок и лёгкий перекус под остаток калорий",
        category: "protein",
      });
    } else {
      ideas.push({
        name: "Омлет из 2 яиц с зеленью",
        calories: Math.min(220, lightCal + 40),
        protein: 14,
        fat: 12,
        carbs: 2,
        portionGrams: 120,
        why: "Быстро закрывает белок и часть калорий",
        category: "balanced",
      });
    }
  }

  return ideas.slice(0, 3);
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

    const deficits: string[] = [];
    if (eaten.protein < target.protein * 0.70) deficits.push(`белков (${remaining.protein} г)`);
    if (eaten.carbs < target.carbs * 0.60) deficits.push(`углеводов (${remaining.carbs} г)`);
    if (eaten.fat < target.fat * 0.60) deficits.push(`жиров (${remaining.fat} г)`);

    const tip = buildTip(pctCalories, deficits, eaten, target);

    if (!process.env.GIGACHAT_CREDENTIALS) {
      const fallback = buildFallbackSuggestions(remaining);
      return NextResponse.json({
        suggestions: fallback,
        eaten,
        target,
        remaining,
        pctCalories,
        tip,
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

    if (suggestions.length < 3) {
      const fallback = buildFallbackSuggestions(remaining);
      const names = new Set(suggestions.map((s) => s.name.toLowerCase()));
      for (const idea of fallback) {
        if (suggestions.length >= 3) break;
        if (names.has(idea.name.toLowerCase())) continue;
        suggestions.push(idea);
      }
    }

    return NextResponse.json({
      suggestions: suggestions.slice(0, 3),
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
