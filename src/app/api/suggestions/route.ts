import { undereatSuggestionTip } from "@/lib/motivation-voice";
import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/auth-session";
import { prisma } from "@/lib/prisma";
import { DIET_PROFILE_SELECT, isSex, isWeightGoal, recommendDietForProfile, round1 } from "@/lib/diet";
import { shiftDateKey } from "@/lib/dates";
import { weightEntryOrderNewestFirst } from "@/lib/weight-entries";
import { decodeHtmlEntities } from "@/lib/html-text";
import {
  aggregateMealHistory,
  mergeSuggestions,
  shouldPinPostWorkoutProtein,
  type HistoryMealCandidate,
  type RankedSuggestion,
} from "@/lib/suggestion-history";

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
  if (pctCalories < 30) return undereatSuggestionTip(pctCalories);
  if (pctCalories < 60) return undereatSuggestionTip(pctCalories);
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
    const postWorkoutParam =
      request.nextUrl.searchParams.get("postWorkout") === "1" ||
      request.nextUrl.searchParams.get("postWorkout") === "true";
    const historyStart = date ? shiftDateKey(date, -90) : "";

    const [entries, user, weight, historyRows, customFoods, gymTodayCount] = await Promise.all([
      prisma.mealEntry.findMany({
        where: { userId: session.user.id, date },
        select: { dishName: true, calories: true, protein: true, fat: true, carbs: true, mealType: true },
        orderBy: { createdAt: "asc" },
      }),
      prisma.user.findUnique({
        where: { id: session.user.id },
        select: { ...DIET_PROFILE_SELECT, name: true },
      }),
      prisma.weightEntry.findFirst({
        where: { userId: session.user.id },
        orderBy: weightEntryOrderNewestFirst,
      }),
      date
        ? prisma.mealEntry.findMany({
            where: {
              userId: session.user.id,
              date: { gte: historyStart, lte: date },
            },
            select: {
              dishName: true,
              calories: true,
              protein: true,
              fat: true,
              carbs: true,
              portionGrams: true,
            },
            orderBy: { createdAt: "desc" },
            take: 500,
          })
        : Promise.resolve([]),
      prisma.customFood.findMany({
        where: { userId: session.user.id },
        select: {
          name: true,
          calories: true,
          protein: true,
          fat: true,
          carbs: true,
          portionGrams: true,
          useCount: true,
        },
        orderBy: [{ useCount: "desc" }, { updatedAt: "desc" }],
        take: 20,
      }),
      date
        ? prisma.workoutSession.count({
            where: { userId: session.user.id, date },
          })
        : Promise.resolve(0),
    ]);

    const goal = isWeightGoal(user?.goal) ? user!.goal : null;
    const sex = isSex(user?.sex) ? user!.sex : null;
    const target = recommendDietForProfile(weight?.weightKg, user);

    if (!goal || !weight || !target) {
      return NextResponse.json({
        suggestions: [],
        reason: "Укажите цель и вес в профиле — тогда смогу рассчитать вашу норму и дать точные рекомендации.",
        tip: "",
      } satisfies Partial<SuggestionsResponse>);
    }
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

    const historyFromMeals = aggregateMealHistory(
      historyRows.map((row) => ({
        dishName: decodeHtmlEntities(row.dishName),
        calories: row.calories,
        protein: row.protein,
        fat: row.fat,
        carbs: row.carbs,
        portionGrams: row.portionGrams,
      })),
      2,
    );
    const favorites: HistoryMealCandidate[] = customFoods.map((food) => ({
      name: decodeHtmlEntities(food.name),
      calories: food.calories,
      protein: food.protein ?? 0,
      fat: food.fat ?? 0,
      carbs: food.carbs ?? 0,
      portionGrams: food.portionGrams ?? 0,
      count: Math.max(1, food.useCount),
      source: "favorite" as const,
    }));
    const historyCandidates = [...historyFromMeals, ...favorites];
    const pinProtein = shouldPinPostWorkoutProtein({
      postWorkoutParam,
      gymToday: gymTodayCount > 0,
      eatenProtein: eaten.protein,
      proteinTarget: target.protein,
    });

    const finalize = (others: RankedSuggestion[]) =>
      mergeSuggestions({
        history: historyCandidates,
        others,
        remaining,
        pinProteinFirst: pinProtein,
        limit: 3,
      });

    if (!process.env.GIGACHAT_CREDENTIALS) {
      return NextResponse.json({
        suggestions: finalize(buildFallbackSuggestions(remaining)),
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

    const historyHint =
      historyCandidates.length > 0
        ? `Часто ели / избранное (предпочитай эти блюда, если закрывают дефицит):\n  ${historyCandidates
            .slice(0, 8)
            .map(
              (h) =>
                `${h.name} (${h.calories} ккал, Б${h.protein}г, ${h.count}×, ${h.source === "favorite" ? "избранное" : "дневник"})`,
            )
            .join("\n  ")}`
        : "";

    const systemPrompt = `Ты опытный диетолог. Ты отвечаешь ТОЛЬКО валидным JSON-массивом из 3 элементов, без пояснений, без markdown.`;

    const userPrompt = `Пользователь: ${sexRu ? `${sexRu}, ` : ""}вес ${weight.weightKg} кг, цель — ${goalRu}.
Время суток: ${timeOfDay}.
Дневная норма: ${target.calories} ккал | Б ${target.protein} г | Ж ${target.fat} г | У ${target.carbs} г

Сегодня съедено (${pctCalories}%):
  ${eatenList}
Итого: ${eaten.calories} ккал | Б ${eaten.protein} г | Ж ${eaten.fat} г | У ${eaten.carbs} г

Остаток: ${remaining.calories} ккал | Б ${remaining.protein} г | Ж ${remaining.fat} г | У ${remaining.carbs} г
${deficits.length ? `Главный дефицит: ${deficits.join(", ")}` : ""}
${pinProtein ? "Сегодня была тренировка — первый совет должен быть с белком." : ""}
${historyHint}

Предложи РОВНО 3 конкретных блюда/продукта:
- По возможности из списка «часто ели / избранное»
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

    const merged = finalize([
      ...suggestions,
      ...buildFallbackSuggestions(remaining),
    ]);

    return NextResponse.json({
      suggestions: merged.slice(0, 3),
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
