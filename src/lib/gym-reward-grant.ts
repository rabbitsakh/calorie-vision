/**
 * Запись зачёта зала в сундук и снимок для значков.
 * Строка UserReward не удаляется вместе с тренировкой.
 */

import { prisma } from "@/lib/prisma";
import { toDateKeyTz } from "@/lib/dates";
import { resolveDayNorm } from "@/lib/day-norm";
import {
  DIET_PROFILE_SELECT,
  isGoalPace,
  isActivityLevel,
  isSex,
  isWeightGoal,
} from "@/lib/diet";
import { isNotableTrainingSession } from "@/lib/training-day";
import { weightEntryOrderNewestFirst } from "@/lib/weight-entries";
import {
  decideGymChestGrant,
  summarizeGymRewards,
  type GymChestDecision,
  type GymRewardSession,
  type GymRewardSummary,
} from "@/lib/gym-rewards";

export type GymChestGrantResult = GymChestDecision | { action: "skip"; reason: "error" };

function isUniqueConflict(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: string }).code === "P2002"
  );
}

export async function grantGymChestForDate(
  userId: string,
  date: string,
): Promise<GymChestGrantResult> {
  try {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return { action: "skip", reason: "no-qualifying-session" };
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { timezone: true },
    });
    const today = toDateKeyTz(new Date(), user?.timezone);
    if (date > today) return { action: "skip", reason: "future-day" };

    const sessions = await prisma.workoutSession.findMany({
      where: { userId, date, endedAt: { not: null } },
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
      select: {
        id: true,
        date: true,
        createdAt: true,
        exercises: {
          select: {
            name: true,
            kind: true,
            catalogId: true,
            sets: {
              select: {
                completed: true,
                setType: true,
                weightKg: true,
                reps: true,
                distanceKm: true,
                durationSec: true,
              },
            },
          },
        },
      },
    });

    const candidates: GymRewardSession[] = sessions.map((session) => ({
      id: session.id,
      date: session.date,
      createdAt: session.createdAt,
      ended: true,
      exercises: session.exercises,
    }));
    if (
      decideGymChestGrant({
        date,
        today,
        sessions: candidates,
        protein: 0,
        proteinTarget: 0,
        existingSourceKeys: [],
      }).action === "skip"
    ) {
      return { action: "skip", reason: "no-qualifying-session" };
    }

    const keys = await prisma.userReward.findMany({
      where: {
        userId,
        OR: [
          { sourceKey: { startsWith: `gym-chest:${date}:session:` } },
          ...candidates.map((session) => ({
            sourceKey: { endsWith: `:session:${session.id}` },
          })),
        ],
      },
      select: { sourceKey: true },
    });
    const existingSourceKeys = keys.map((row) => row.sourceKey);
    // Вид «комбо» в строку не пишется: ключ один на день, отметка комбо считается
    // из тренировки и белка. Иначе гонка «зал»/«комбо» дала бы два зачёта.
    const decision = decideGymChestGrant({
      date,
      today,
      sessions: candidates,
      protein: 0,
      proteinTarget: 0,
      existingSourceKeys,
    });
    if (decision.action === "skip") return decision;

    try {
      await prisma.userReward.create({
        data: {
          userId,
          rewardKey: "quest_day",
          source: "quest",
          sourceKey: decision.sourceKey,
        },
      });
    } catch (error) {
      if (isUniqueConflict(error)) {
        return { action: "skip", reason: "day-already-credited" };
      }
      throw error;
    }
    return decision;
  } catch (error) {
    console.error("gym chest grant", error);
    return { action: "skip", reason: "error" };
  }
}

const EMPTY_SUMMARY: GymRewardSummary = {
  gymSessionCount: 0,
  gymPrBeats: 0,
  gymBestWeekSessions: 0,
  comboDates: [],
  comboDayCount: 0,
  comboStreakBest: 0,
};

/**
 * Значки по уже записанным тренировкам.
 * Цель по белку — текущий профиль и последний вес; в день заметной тренировки
 * к ней прибавляется та же надбавка, что в дневнике. Повторный вызов ничего не дублирует:
 * значок пишется один раз по уникальному ключу.
 */
export async function loadGymBadgeSnapshot(userId: string): Promise<GymRewardSummary> {
  const [user, weight, sessions, proteins] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      select: DIET_PROFILE_SELECT,
    }),
    prisma.weightEntry.findFirst({
      where: { userId },
      orderBy: weightEntryOrderNewestFirst,
    }),
    prisma.workoutSession.findMany({
      where: { userId, endedAt: { not: null } },
      select: {
        id: true,
        date: true,
        createdAt: true,
        exercises: {
          select: {
            name: true,
            kind: true,
            catalogId: true,
            sets: {
              select: {
                completed: true,
                setType: true,
                weightKg: true,
                reps: true,
                distanceKm: true,
                durationSec: true,
              },
            },
          },
        },
      },
    }),
    prisma.mealEntry.groupBy({
      by: ["date"],
      where: { userId },
      _sum: { protein: true },
    }),
  ]);

  if (sessions.length === 0) return EMPTY_SUMMARY;

  const rewardSessions: GymRewardSession[] = sessions.map((session) => ({
    id: session.id,
    date: session.date,
    createdAt: session.createdAt,
    ended: true,
    exercises: session.exercises,
  }));

  const sex = isSex(user?.sex) ? user.sex : null;
  const goal = user?.goal && isWeightGoal(user.goal) ? user.goal : null;
  const plan =
    goal && weight?.weightKg
      ? resolveDayNorm({
          weightKg: weight.weightKg,
          goal,
          pace: isGoalPace(user?.goalPace) ? user.goalPace : null,
          sex,
          heightCm: user?.heightCm,
          birthYear: user?.birthYear,
          activity: isActivityLevel(user?.activityLevel) ? user.activityLevel : null,
        })
      : null;

  const byDate = new Map<string, GymRewardSession[]>();
  for (const session of rewardSessions) {
    const list = byDate.get(session.date) ?? [];
    list.push(session);
    byDate.set(session.date, list);
  }

  const proteinTargetByDate: Record<string, number> = {};
  for (const [date, daySessions] of byDate) {
    if (!plan) {
      proteinTargetByDate[date] = 0;
      continue;
    }
    const notable = daySessions.some((session) =>
      isNotableTrainingSession({
        exercises: session.exercises.map((exercise) => ({
          kind: exercise.kind,
          sets: exercise.sets.map((set) => ({
            completed: set.completed,
            setType: set.setType,
            durationSec: set.durationSec,
            distanceKm: set.distanceKm,
          })),
        })),
      }),
    );
    proteinTargetByDate[date] = notable
      ? resolveDayNorm({
          weightKg: weight!.weightKg,
          goal: goal!,
          pace: isGoalPace(user?.goalPace) ? user.goalPace : null,
          sex,
          heightCm: user?.heightCm,
          birthYear: user?.birthYear,
          activity: isActivityLevel(user?.activityLevel) ? user.activityLevel : null,
          trainingDay: true,
        }).target.protein
      : plan.target.protein;
  }

  const proteinByDate: Record<string, number> = {};
  for (const row of proteins) {
    proteinByDate[row.date] = row._sum.protein ?? 0;
  }

  return summarizeGymRewards({
    sessions: rewardSessions,
    proteinByDate,
    proteinTargetByDate,
  });
}
