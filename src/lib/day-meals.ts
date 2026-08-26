import { prisma } from "@/lib/prisma";
import {
  applyFiberSugarOverrides,
  calorieTone,
  compareNutrient,
  explainDiet,
  formatGoalChoice,
  isActivityLevel,
  isSex,
  round1,
  type GoalPace,
  type WeightGoal,
} from "@/lib/diet";
import { decodeHtmlEntities } from "@/lib/html-text";
import { weightEntryOrderNewestFirst } from "@/lib/weight-entries";

export async function buildDayMealsPayload(userId: string, date: string) {
  const [entries, user, weight] = await Promise.all([
    prisma.mealEntry.findMany({
      where: { userId, date },
      orderBy: { createdAt: "desc" },
    }),
    prisma.user.findUnique({
      where: { id: userId },
      select: {
        goal: true,
        goalPace: true,
        sex: true,
        heightCm: true,
        birthYear: true,
        activityLevel: true,
        fiberTargetG: true,
        sugarTargetG: true,
      },
    }),
    prisma.weightEntry.findFirst({
      where: { userId, date: { lte: date } },
      orderBy: weightEntryOrderNewestFirst,
    }),
  ]);

  const totalCalories = entries.reduce((sum, item) => sum + item.calories, 0);
  const totalProtein = round1(entries.reduce((sum, item) => sum + (item.protein ?? 0), 0));
  const totalFat = round1(entries.reduce((sum, item) => sum + (item.fat ?? 0), 0));
  const totalCarbs = round1(entries.reduce((sum, item) => sum + (item.carbs ?? 0), 0));
  const totalFiber = round1(entries.reduce((sum, item) => sum + (item.fiber ?? 0), 0));
  const totalSugar = round1(entries.reduce((sum, item) => sum + (item.sugar ?? 0), 0));
  const goal = (user?.goal ?? null) as WeightGoal | null;
  const goalPace = (user?.goalPace ?? null) as GoalPace | null;
  const sex = isSex(user?.sex) ? user!.sex : null;
  const activity = isActivityLevel(user?.activityLevel) ? user!.activityLevel : null;
  const breakdown =
    goal && weight
      ? explainDiet(
          weight.weightKg,
          goal,
          goalPace,
          sex,
          user?.heightCm,
          user?.birthYear,
          activity,
        )
      : null;
  const target = breakdown
    ? applyFiberSugarOverrides(breakdown.target, {
        fiberTargetG: user?.fiberTargetG,
        sugarTargetG: user?.sugarTargetG,
      })
    : null;
  const comparison = target
    ? {
        calories: compareNutrient(totalCalories, target.calories),
        protein: compareNutrient(totalProtein, target.protein),
        fat: compareNutrient(totalFat, target.fat),
        carbs: compareNutrient(totalCarbs, target.carbs),
        fiber: compareNutrient(totalFiber, target.fiber),
        sugar: compareNutrient(totalSugar, target.sugar),
      }
    : null;

  return {
    entries: entries.map((entry) => ({
      ...entry,
      dishName: decodeHtmlEntities(entry.dishName),
      originalDish: entry.originalDish ? decodeHtmlEntities(entry.originalDish) : entry.originalDish,
    })),
    totalCalories,
    totalProtein,
    totalFat,
    totalCarbs,
    totalFiber,
    totalSugar,
    goal,
    goalPace,
    dietLabel: goal ? formatGoalChoice(goal, goalPace) : null,
    sex,
    weightKg: weight?.weightKg ?? null,
    target,
    calorieExplanation: breakdown?.explanation ?? null,
    comparison,
    calorieTone: goal && comparison ? calorieTone(comparison.calories, goal) : null,
  };
}
