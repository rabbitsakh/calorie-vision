/**
 * Норма дня из базы: тот же resolveDayNorm, что у ленты и карточки.
 * Ручные цели пользователя читаются и не перезаписываются.
 */

import { resolveDayNorm, type DayNormResult } from "@/lib/day-norm";
import { DIET_PROFILE_SELECT, isActivityLevel, isGoalPace, isSex, isWeightGoal } from "@/lib/diet";
import { prisma } from "@/lib/prisma";
import { isNotableTrainingSession } from "@/lib/training-day";
import { weightEntryOrderNewestFirst } from "@/lib/weight-entries";
import { estimateDbSessionEnergy } from "@/lib/workouts/energy";
import { serializeSessionSummary, sessionInclude } from "@/lib/workouts/serialize";

export async function loadDayNorm(userId: string, date: string): Promise<DayNormResult | null> {
  const [user, weight, latestWeight, sessions] = await Promise.all([
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
  if (!user || !isWeightGoal(user.goal) || !weight) return null;
  const burnWeight = latestWeight?.weightKg ?? weight.weightKg;
  const trained = sessions.map((row) => {
    const summary = serializeSessionSummary(row);
    const energy = estimateDbSessionEnergy(row, burnWeight);
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
      kcal: energy.kcal,
      approximate: energy.approximate,
    };
  });
  const notable = trained.filter((session) => session.notable);
  return resolveDayNorm({
    weightKg: weight.weightKg,
    goal: user.goal,
    pace: isGoalPace(user.goalPace) ? user.goalPace : null,
    sex: isSex(user.sex) ? user.sex : null,
    heightCm: user.heightCm,
    birthYear: user.birthYear,
    activity: isActivityLevel(user.activityLevel) ? user.activityLevel : null,
    burnKcal: trained.reduce((sum, session) => sum + Math.max(0, session.kcal), 0),
    trainingDay: notable.length > 0,
    burnApproximate: trained.some((session) => session.kcal > 0 && session.approximate),
    sessionCount: notable.length,
    fiberTargetG: user.fiberTargetG,
    sugarTargetG: user.sugarTargetG,
    waterTargetMl: user.waterTargetMl,
  });
}
