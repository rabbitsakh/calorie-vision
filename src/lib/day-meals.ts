import { prisma } from "@/lib/prisma";
import { resolveDayNorm } from "@/lib/day-norm";
import {
  calorieTone,
  compareNutrient,
  DIET_PROFILE_SELECT,
  formatGoalChoice,
  isActivityLevel,
  isGoalPace,
  isSex,
  isWeightGoal,
  round1,
} from "@/lib/diet";
import { decodeHtmlEntities } from "@/lib/html-text";
import { isNotableTrainingSession } from "@/lib/training-day";
import { recommendWaterMl, resolveWaterTargetMl } from "@/lib/water-target";
import { weightEntryOrderNewestFirst } from "@/lib/weight-entries";
import { estimateDbSessionEnergy } from "@/lib/workouts/energy";
import { serializeSessionSummary, sessionInclude } from "@/lib/workouts/serialize";
import { isComboDay, sessionQualifiesForGymReward } from "@/lib/gym-rewards";

export async function buildDayMealsPayload(userId: string, date: string) {
  const [entries, user, weight, latestWeight, sessions] = await Promise.all([
    prisma.mealEntry.findMany({
      where: { userId, date },
      orderBy: { createdAt: "desc" },
    }),
    prisma.user.findUnique({
      where: { id: userId },
      select: {
        ...DIET_PROFILE_SELECT,
        fiberTargetG: true,
        sugarTargetG: true,
        waterTargetMl: true,
      },
    }),
    prisma.weightEntry.findFirst({
      where: { userId, date: { lte: date } },
      orderBy: weightEntryOrderNewestFirst,
    }),
    prisma.weightEntry.findFirst({
      where: { userId },
      orderBy: weightEntryOrderNewestFirst,
    }),
    prisma.workoutSession.findMany({
      where: { userId, date },
      include: sessionInclude,
    }),
  ]);

  const totalCalories = entries.reduce((sum, item) => sum + item.calories, 0);
  const totalProtein = round1(entries.reduce((sum, item) => sum + (item.protein ?? 0), 0));
  const totalFat = round1(entries.reduce((sum, item) => sum + (item.fat ?? 0), 0));
  const totalCarbs = round1(entries.reduce((sum, item) => sum + (item.carbs ?? 0), 0));
  const totalFiber = round1(entries.reduce((sum, item) => sum + (item.fiber ?? 0), 0));
  const totalSugar = round1(entries.reduce((sum, item) => sum + (item.sugar ?? 0), 0));
  const goal = isWeightGoal(user?.goal) ? user.goal : null;
  const goalPace = isGoalPace(user?.goalPace) ? user.goalPace : null;
  const sex = isSex(user?.sex) ? user!.sex : null;
  const activity = isActivityLevel(user?.activityLevel) ? user!.activityLevel : null;
  const burnWeightKg = latestWeight?.weightKg ?? weight?.weightKg ?? null;
  const trained = sessions.map((row) => {
    const summary = serializeSessionSummary(row);
    const sessionEnergy = estimateDbSessionEnergy(row, burnWeightKg);
    return {
      notable: isNotableTrainingSession({
        cardioOnly: summary.cardioOnly,
        cardioDurationSec: summary.cardioDurationSec,
        cardioDistanceKm: summary.cardioDistanceKm,
        elapsedSec: summary.elapsedSec,
        totalLoad: summary.totalLoad,
        exerciseCount: summary.exerciseCount,
        exercises: row.exercises,
      }),
      energy: sessionEnergy,
    };
  });
  const burnKcal = trained.reduce((sum, session) => sum + Math.max(0, session.energy.kcal), 0);
  const burnApproximate = trained.some((session) => session.energy.kcal > 0 && session.energy.approximate);
  const notable = trained.filter((session) => session.notable);
  const norm =
    goal && weight
      ? resolveDayNorm({
          weightKg: weight.weightKg,
          goal,
          pace: goalPace,
          sex,
          heightCm: user?.heightCm,
          birthYear: user?.birthYear,
          activity,
          burnKcal,
          trainingDay: notable.length > 0,
          burnApproximate,
          sessionCount: notable.length,
          fiberTargetG: user?.fiberTargetG,
          sugarTargetG: user?.sugarTargetG,
          waterTargetMl: user?.waterTargetMl,
        })
      : null;
  const target = norm?.target ?? null;
  const trainingDay = norm?.training ?? null;
  const waterTargetMl =
    norm?.target.waterMl ??
    (user?.waterTargetMl != null
      ? resolveWaterTargetMl(user.waterTargetMl)
      : recommendWaterMl(burnWeightKg ?? 0, sex, notable.length > 0, user?.heightCm));
  const qualifyingWorkout = sessions.some((row) =>
    sessionQualifiesForGymReward(
      row.endedAt != null,
      row.exercises.flatMap((exercise) => exercise.sets),
    ),
  );
  const comboDay = isComboDay({
    qualifyingWorkout,
    protein: totalProtein,
    proteinTarget: target?.protein ?? 0,
  });
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
    trainingDay,
    comboDay,
    calorieExplanation: norm?.explanation ?? null,
    waterTargetMl,
    comparison,
    calorieTone: goal && comparison ? calorieTone(comparison.calories, goal) : null,
  };
}
